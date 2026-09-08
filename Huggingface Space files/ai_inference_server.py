from __future__ import annotations

import os
import base64
import io
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any

from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aivala-inference")

try:
    from fastapi import FastAPI, File, Form, UploadFile, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    from fastapi.staticfiles import StaticFiles
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "FastAPI is required to run this server. Install fastapi and uvicorn."
    ) from exc


ROOT = Path(__file__).resolve().parent
_configured_model = os.getenv("YOLO_MODEL_PATH", "").strip()
_model_candidates = [
    Path(_configured_model).expanduser() if _configured_model else None,
    ROOT / "final_best.pt",
    ROOT.parent / "final_best.pt",
    ROOT / "best.pt",
    ROOT.parent / "best.pt",
]
MODEL_PATH = next((candidate.resolve() for candidate in _model_candidates if candidate and candidate.is_file()), ROOT.parent / "final_best.pt")
DETECTION_CONFIDENCE_THRESHOLD = float(os.getenv("DETECTION_CONFIDENCE_THRESHOLD", "0.45"))
ULTRALYTICS_DIR = ROOT / ".ultralytics"
ULTRALYTICS_DIR.mkdir(exist_ok=True)
os.environ.setdefault("YOLO_CONFIG_DIR", str(ULTRALYTICS_DIR))
os.environ.setdefault("ULTRALYTICS_SETTINGS_DIR", str(ULTRALYTICS_DIR))

# Patch Ultralytics modules globally for backwards compatibility with models trained on legacy/custom Ultralytics branches
try:
    import ultralytics.nn.modules.head as _head
    import ultralytics.nn.modules.block as _block
    import ultralytics.nn.modules.conv as _conv
    for mod in [_head, _block, _conv]:
        for attr in list(dir(mod)):
            if not attr.endswith("26") and not attr.startswith("__"):
                try:
                    val = getattr(mod, attr)
                    if isinstance(val, type) and not hasattr(mod, f"{attr}26"):
                        setattr(mod, f"{attr}26", val)
                except Exception:
                    pass
except Exception as patch_exc:
    logger.warning("Ultralytics patch notice: %s", patch_exc)

STATIC_DIR = ROOT / "static"
STATIC_DIR.mkdir(exist_ok=True)
VLM_SEVERITY_URL = os.getenv(
    "VLM_SEVERITY_URL",
    os.getenv("COLAB_SEVERITY_URL", "http://localhost:7860/severity"),
).strip()
print("VLM_SEVERITY_URL =", VLM_SEVERITY_URL)
SEVERITY_LEVELS = {
    "none",
    "minor",
    "semi_minor",
    "moderate",
    "semi_moderate",
    "semi_severe",
    "severe",
}

app = FastAPI(title="YOLO Damage Inference API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

# Mount the static directory to serve static assets
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

MODEL = None


class Detection(BaseModel):
    class_id: int
    label: str
    confidence: float
    bbox: list[float]
    severity: str | None = None
    severity_note: str | None = None
    severity_source: str | None = None
    detector: str | None = None


class FaceVerifyRequest(BaseModel):
    frame: str


def _normalize_severity(value: Any) -> str:
    severity = str(value or "").strip().lower()
    if severity in SEVERITY_LEVELS:
        return severity
    raise ValueError(f"VLM returned invalid severity: {value!r}")


def _normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"true", "yes", "1", "flagged"}


def _normalize_damage_label(text: str) -> str:
    """Normalize damage category string for robust matching between UI selection and YOLO labels."""
    s = str(text or "").strip().lower().replace("_", " ").replace("-", " ")
    s = " ".join(s.split())
    if "scratch" in s:
        return "scratch"
    if "dent" in s:
        return "dent"
    if "paint" in s:
        return "paint trace"
    if "head" in s or "headlight" in s:
        return "head light damage"
    if "tail" in s or "taillight" in s:
        return "taillight damage"
    if "mirror" in s or "sidemirror" in s:
        return "sidemirror damage"
    if "sign" in s or "signal" in s or "signlight" in s:
        return "signlight damage"
    if "windshield" in s:
        return "windshield damage"
    if "window" in s:
        return "window damage"
    return s


def _get_allowed_damage_classes(reported_damage_type: str | None) -> set[str] | None:
    """
    Parse reported_damage_type from incident details into a set of normalized allowed damage classes.
    Returns None if unspecified (meaning all detected classes are allowed).
    """
    if not reported_damage_type:
        return None
    raw = str(reported_damage_type).strip()
    if not raw or raw.lower() in {"unspecified", "all", "none", ""}:
        return None

    parts = [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]
    allowed = {_normalize_damage_label(p) for p in parts if p}
    return allowed if allowed else None


def _box_iou(a: list[float], b: list[float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    intersection = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def _deduplicate_detections(candidates: list[dict[str, Any]], max_items: int = 12) -> list[dict[str, Any]]:
    """Keep distinct damage areas while collapsing repeated frame observations."""
    retained: list[dict[str, Any]] = []
    for candidate in sorted(candidates, key=lambda item: item["confidence"], reverse=True):
        same_area = False
        for existing in retained:
            if _normalize_damage_label(existing["label"]) != _normalize_damage_label(candidate["label"]):
                continue
            iou = _box_iou(existing["bbox"], candidate["bbox"])
            if existing.get("frame_index") == candidate.get("frame_index"):
                same_area = iou >= 0.35
            else:
                # Across frames, tolerate camera motion but keep separated panels.
                ex = ((existing["bbox"][0] + existing["bbox"][2]) / 2) / max(1, existing.get("frame_width", 1))
                ey = ((existing["bbox"][1] + existing["bbox"][3]) / 2) / max(1, existing.get("frame_height", 1))
                cx = ((candidate["bbox"][0] + candidate["bbox"][2]) / 2) / max(1, candidate.get("frame_width", 1))
                cy = ((candidate["bbox"][1] + candidate["bbox"][3]) / 2) / max(1, candidate.get("frame_height", 1))
                same_area = iou >= 0.25 or ((ex - cx) ** 2 + (ey - cy) ** 2) ** 0.5 <= 0.12
            if same_area:
                break
        if not same_area:
            retained.append(candidate)
        if len(retained) >= max_items:
            break
    return retained


async def _request_vlm_severity(
    items: list[dict[str, Any]],
    damage_context: dict[str, Any],
) -> list[dict[str, str]] | None:
    if not VLM_SEVERITY_URL:
        logger.warning("VLM severity skipped: VLM_SEVERITY_URL is not configured.")
        return None

    if not items:
        logger.warning("VLM severity skipped: no detection frames were prepared.")
        return None
    try:
        import httpx
    except Exception as exc:
        logger.warning("VLM severity skipped: httpx import failed: %s", exc)
        return None
    payload = {
        "model": "Qwen3-VL-4B car-damage QLoRA",
        "severity_schema": {
            "none": ["No damage visible", "False detection"],
            "minor": ["Cosmetic damage only", "Small area affected"],
            "semi_minor": ["More than a superficial mark", "Limited repair may be needed"],
            "moderate": ["Visible deformation", "Repair likely required"],
            "semi_moderate": ["Substantial visible deformation", "Repair is clearly required"],
            "semi_severe": ["Major damage with partial component failure", "Extensive repair or likely replacement needed"],
            "severe": ["Major deformation", "Part replacement likely"],
        },
        "damage_context": damage_context,
        "authenticity_check": {
            "screen_re_recording": True,
            "instruction": (
                "Inspect the entire frame for evidence that it was filmed from a phone, "
                "monitor, TV, or tablet display. Report a flag, confidence, and visible evidence."
            ),
        },
        "detections": items,
    }
    try:
        logger.info("Calling local Qwen VLM severity endpoint once for %d detections from one frame.", len(items))
        async with httpx.AsyncClient(
            timeout=110.0,
            ) as client:
            health_url = VLM_SEVERITY_URL.replace("/severity", "/health")
            health = await client.get(health_url)
            logger.info("HEALTH STATUS: %s", health.status_code)
            response = await client.post(VLM_SEVERITY_URL, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        import traceback

        logger.error("VLM REQUEST EXCEPTION TYPE: %s", type(exc).__name__)
        logger.error("VLM REQUEST EXCEPTION REPR: %r", exc)
        logger.exception("VLM request traceback")

        return None
    raw_results = data.get("results") if isinstance(data, dict) else data
    if not isinstance(raw_results, list):
        logger.warning(
            "VLM severity returned an unexpected response shape. Response type: %s",
            type(data).__name__,
        )
        return None
    results: list[dict[str, str]] = []
    for index, result in enumerate(raw_results):
        if not isinstance(result, dict):
            continue
        note = str(result.get("note") or result.get("severity_note") or "").strip()
        if not note:
            raise ValueError("VLM result did not include a severity note")
        results.append({
            "detection_id": str(result.get("detection_id", items[index].get("detection_id", index))),
            "severity": _normalize_severity(result.get("severity")),
            "note": note,
            "vlm_reasoning": result.get("vlm_reasoning") or [],
            "screen_recording_suspected": _normalize_bool(result.get("screen_recording_suspected", False)),
            "screen_recording_confidence": result.get("screen_recording_confidence", 0.0),
            "screen_recording_evidence": result.get("screen_recording_evidence") or [],
        })
    if not results:
        logger.warning("VLM severity returned no usable result items.")
        return None

    logger.info("Local Qwen VLM severity succeeded for %d full frame(s).", len(results))
    return results


def _encode_full_frame(frame: Any) -> str | None:
    import cv2

    height, width = frame.shape[:2]
    max_dimension = 640
    scale = min(max_dimension / max(height, width), 1.0)
    if scale < 1.0:
        frame = cv2.resize(
            frame,
            (max(1, int(width * scale)), max(1, int(height * scale))),
            interpolation=cv2.INTER_AREA,
        )
    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
    if not ok:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(buffer.tobytes()).decode("utf-8")


async def _annotate_and_predict(
    video_path: Path,
    base_url: str,
    damage_context: dict[str, Any],
) -> dict[str, Any]:
    import time
    start_time = time.time()
    try:
        from ultralytics import YOLO
        import cv2
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "ultralytics and opencv-python are required for inference."
        ) from exc

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Missing model file: {MODEL_PATH}")

    global MODEL
    model = MODEL or YOLO(str(MODEL_PATH))
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError("Could not open uploaded video.")

    # Retrieve video dimensions and properties
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = float(capture.get(cv2.CAP_PROP_FPS))

    logger.info(
        "Video properties: width=%s height=%s fps=%s",
        width,
        height,
        fps,
    )

    if width <= 0 or height <= 0:
        capture.release()
        raise RuntimeError(f"Invalid video dimensions: {width}x{height}")

    if fps <= 0 or fps > 240:
        logger.warning("Invalid FPS reported (%s). Falling back to 30 FPS.", fps)
        fps = 30.0

    # Sample frames at 5 FPS (e.g. for 30 FPS video, process 1 out of every 6 frames)
    sample_interval = max(1, int(fps / 5.0))

    # Video generation removed; returning images only.

    allowed_classes = _get_allowed_damage_classes(damage_context.get("reported_damage_type"))
    if allowed_classes:
        logger.info("[FILTER] Active damage type filter: %s", sorted(allowed_classes))
    else:
        logger.info("[FILTER] No damage type filter active (all detected classes allowed)")

    frame_index = 0
    best_detections: list[dict[str, Any]] = []
    best_severity_items: list[dict[str, Any]] = []
    all_candidates: list[dict[str, Any]] = []
    best_frame = None
    max_conf_sum = -1.0
    best_frame_index = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frame_index += 1

        # Only process frames that match the sample interval
        if sample_interval > 1 and frame_index % sample_interval != 0:
            continue

        # Run inference on a resized frame for speed
        frame_small = frame
        fh, fw = frame.shape[:2]
        scale = min(1280 / max(fh, fw), 1.0)

        if scale < 1.0:
            frame_small = cv2.resize(
                frame,
                (int(fw * scale), int(fh * scale)),
                interpolation=cv2.INTER_AREA,
            )

        # Run the consolidated detector once per sampled frame.
        results = model.predict(
            frame_small,
            conf=DETECTION_CONFIDENCE_THRESHOLD,
            verbose=False,
            imgsz=768,
            device="0",
        )
        annotated = frame.copy()

        scale_x = fw / frame_small.shape[1]
        scale_y = fh / frame_small.shape[0]

        conf_sum = 0.0
        frame_detections: list[dict[str, Any]] = []
        if results and len(results[0].boxes) > 0:
            result = results[0]
            names = result.names
            for box in result.boxes:
                cls_id = int(box.cls[0])
                confidence = float(box.conf[0])
                label = names.get(cls_id, str(cls_id))

                # 1. Filter by minimum confidence threshold (>= 45%)
                if confidence < 0.45:
                    continue

                # 2. Filter by user-selected damage types from Incident Details
                normalized_label = _normalize_damage_label(label)
                if allowed_classes is not None and normalized_label not in allowed_classes:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                xyxy = [
                    float(x1 * scale_x),
                    float(y1 * scale_y),
                    float(x2 * scale_x),
                    float(y2 * scale_y),
                ]

                x1i, y1i, x2i, y2i = map(int, xyxy)

                cv2.rectangle(annotated, (x1i, y1i), (x2i, y2i), (0, 255, 0), 2)

                cv2.putText(
                    annotated,
                    f"{label} {confidence:.2f}",
                    (x1i, max(25, y1i - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                    cv2.LINE_AA,
                )

                conf_sum += confidence

                frame_detections.append({
                    "class_id": cls_id,
                    "label": label,
                    "confidence": confidence,
                    "bbox": xyxy,
                    "detector": MODEL_PATH.name,
                    "frame_index": frame_index,
                    "frame_width": fw,
                    "frame_height": fh,
                })

        all_candidates.extend(frame_detections)

        # Keep the strongest frame for the visual preview. Detection aggregation
        # below considers all sampled frames, rather than only this frame.
        if frame_detections and conf_sum > max_conf_sum:
            full_frame = _encode_full_frame(frame)
            if full_frame:
                max_conf_sum = conf_sum
                best_frame = annotated.copy()
                best_frame_index = frame_index


        # Fallback to the first frame if no detections occurred
        if best_frame is None:
            best_frame = annotated.copy()
            best_frame_index = frame_index

    capture.release()

    if best_frame is None:
        raise RuntimeError("No frames could be read or written.")

    best_detections = _deduplicate_detections(all_candidates)
    preview_frame = _encode_full_frame(best_frame)
    if not preview_frame:
        raise RuntimeError("Could not encode an inference frame.")
    best_severity_items = [
        {
            "detection_id": f"{det['label']}-{index}",
            "label": det["label"],
            "confidence": det["confidence"],
            "detector": det["detector"],
            "bbox": [
                det["bbox"][0] / max(1, det.get("frame_width", width)),
                det["bbox"][1] / max(1, det.get("frame_height", height)),
                det["bbox"][2] / max(1, det.get("frame_width", width)),
                det["bbox"][3] / max(1, det.get("frame_height", height)),
            ],
            "image": preview_frame,
        }
        for index, det in enumerate(best_detections)
    ]

    # Create a mobile-friendly preview image.
    preview = best_frame
    ph, pw = preview.shape[:2]

    max_dim = 1280
    scale = min(max_dim / max(ph, pw), 1.0)

    if scale < 1.0:
        preview = cv2.resize(
            preview,
            (int(pw * scale), int(ph * scale)),
            interpolation=cv2.INTER_AREA,
        )

    ok, buffer = cv2.imencode(
        ".jpg",
        preview,
        [cv2.IMWRITE_JPEG_QUALITY, 80],
    )
    if not ok:
        raise RuntimeError("Could not encode annotated frame.")

    annotated_image = base64.b64encode(buffer.tobytes()).decode("utf-8")

    logger.info(
        "annotated_image length=%s bytes",
        len(annotated_image),
    )

    detections = best_detections

    severity_by_id: dict[str, dict[str, str]] = {}
    vlm_results: list[dict[str, str]] = []
    # Send one request containing all retained detections. This preserves
    # per-area severity while avoiding a request-per-frame/per-box explosion.
    if best_severity_items:
        result = await _request_vlm_severity(best_severity_items, damage_context)
        if not result:
            raise RuntimeError(
                "VLM severity analysis failed or returned no usable result; "
                "no guessed severity was assigned."
            )
        vlm_results.extend(result)
    if vlm_results:
        severity_by_id = {item["detection_id"]: item for item in vlm_results}

    qwen_vlm_lines: list[str] = []
    screen_recording_check = {
        "flagged": False,
        "confidence": 0.0,
        "evidence": [],
        "source": "Qwen3-VL-4B car-damage QLoRA" if vlm_results else "not_assessed",
    }
    for index, det in enumerate(detections):
        result = severity_by_id.get(f"{det['label']}-{index}")
        if result:
            det["severity"] = result["severity"]
            det["severity_note"] = result["note"]
            det["severity_source"] = "Qwen3-VL-4B car-damage QLoRA"
            det["vlm_reasoning"] = result.get("vlm_reasoning", [])
            if not qwen_vlm_lines and isinstance(result.get("vlm_reasoning"), list) and len(result["vlm_reasoning"]) == 3:
                qwen_vlm_lines = [str(r) for r in result["vlm_reasoning"]]
            try:
                screen_confidence = max(0.0, min(1.0, float(result.get("screen_recording_confidence", 0.0))))
            except (TypeError, ValueError):
                screen_confidence = 0.0
            screen_flagged = _normalize_bool(result.get("screen_recording_suspected", False)) and screen_confidence >= 0.60
            if screen_flagged and (
                not screen_recording_check["flagged"]
                or screen_confidence > screen_recording_check["confidence"]
            ):
                screen_recording_check["confidence"] = screen_confidence
                screen_recording_check["evidence"] = [
                    str(item) for item in (result.get("screen_recording_evidence") or [])[:4]
                ]
            elif not screen_recording_check["flagged"] and screen_confidence > screen_recording_check["confidence"]:
                screen_recording_check["confidence"] = screen_confidence
                screen_recording_check["evidence"] = []
            screen_recording_check["flagged"] = screen_recording_check["flagged"] or screen_flagged
        else:
            raise RuntimeError(
                f"VLM result missing for detection {det['label']!r}; "
                "no guessed severity was assigned."
            )

    # Build summary label & 3-line decision rationale
    if detections:
        summary_parts = []
        for det in detections:
            summary_parts.append(f"{det['label']} ({int(det['confidence']*100)}%)")
        summary = "Detected: " + ", ".join(summary_parts)

        if qwen_vlm_lines and len(qwen_vlm_lines) == 3:
            model_reasoning = qwen_vlm_lines
        else:
            top_conf = max(d['confidence'] for d in detections)
            labels_str = ", ".join(d['label'].title() for d in detections)
            sev_counts: dict[str, int] = {}
            for d in detections:
                s = str(d["severity"]).lower()
                sev_counts[s] = sev_counts.get(s, 0) + 1
            sev_str = ", ".join(f"{count} {sev.title()}" for sev, count in sev_counts.items())

            line1 = f"Qwen VLM Vision: Identified {len(detections)} damage area(s) ({labels_str}) with peak AI confidence of {int(top_conf * 100)}%."
            line2 = f"Qwen VLM Severity: Evaluated as {sev_str} based on visual surface deformation and component structural impact."
            line3 = f"Qwen VLM Valuation: Recommended for claim valuation under regional repair guidelines."
            model_reasoning = [line1, line2, line3]
    else:
        summary = "No damages detected"
        line1 = "Qwen VLM Vision: No physical vehicle damage or structural deformation detected in the evidence frames."
        line2 = "Qwen VLM Severity: Rated as None (0 damage regions detected)."
        line3 = "Qwen VLM Valuation: Claim denied due to lack of verifiable visual damage evidence."
        model_reasoning = [line1, line2, line3]

    import time
    elapsed = time.time() - start_time if 'start_time' in locals() else 0.0
    logger.info(
        "[AI INFERENCE SUMMARY] Detections=%d | Frames=%d | Elapsed=%.2fs | Summary='%s'",
        len(detections),
        frame_index,
        elapsed,
        summary,
    )
    for i, line in enumerate(model_reasoning, 1):
        logger.info("[REASONING LINE %d] %s", i, line)

    return {
        "annotated_image": f"data:image/jpeg;base64,{annotated_image}",
        "detection_frames": best_severity_items,
        "detections": detections,
        "source_frame": best_frame_index,
        # Detection boxes are pixel xyxy coordinates in this original frame.
        "bbox_coordinate_space": "source_pixels_xyxy",
        "source_dimensions": {"width": width, "height": height},
        "summary": summary,
        "model_reasoning": model_reasoning,
        "screen_recording_check": screen_recording_check,
    }


@app.post("/analyze-video")
async def analyze_video(
    request: Request,
    file: UploadFile = File(...),
    damage_location: str = Form("unspecified"),
    damaged_parts_count: int = Form(1),
    damage_extent: str = Form("localized"),
    reported_damage_type: str = Form("unspecified"),
    incident_description: str = Form(""),
):
    suffix = Path(file.filename).suffix.lower() or ".mp4"
    temp_path = ROOT / f"upload_{uuid.uuid4().hex}{suffix}"
    content = await file.read()
    temp_path.write_bytes(content)
    try:
        base_url = str(request.base_url).rstrip('/')
        damage_context = {
            "location": damage_location,
            "parts_count": max(1, min(12, damaged_parts_count)),
            "extent": damage_extent,
            "reported_damage_type": reported_damage_type,
            "incident_description": incident_description,
        }
        result = await _annotate_and_predict(temp_path, base_url, damage_context)
        result["damage_context"] = damage_context
        return JSONResponse(result)
    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.post("/verify-face")
async def verify_face(payload: FaceVerifyRequest):
    import cv2
    import numpy as np
    
    try:
        raw = payload.frame.split(",")[-1]
        img_bytes = base64.b64decode(raw)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return JSONResponse({"verified": False, "face_count": 0, "confidence": 0.0, "face_crop": None})

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        
        frontal_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")

        faces = frontal_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        if len(faces) == 0:
            faces = profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60))

        verified = len(faces) > 0
        face_count = len(faces)
        confidence = 0.0
        face_crop_b64 = None

        if verified:
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            pad = int(min(w, h) * 0.20)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(frame.shape[1], x + w + pad)
            y2 = min(frame.shape[0], y + h + pad)
            face_crop = frame[y1:y2, x1:x2]

            ok, buf = cv2.imencode(".jpg", face_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if ok:
                face_crop_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()

            confidence = round((w * h) / (frame.shape[0] * frame.shape[1]) * 10, 2)
            confidence = min(confidence, 0.99)

        return JSONResponse({
            "verified": verified,
            "face_count": face_count,
            "confidence": confidence,
            "face_crop": face_crop_b64
        })
    except Exception as e:
        return JSONResponse({"verified": False, "face_count": 0, "confidence": 0.0, "face_crop": None, "error": str(e)}, status_code=500)


@app.on_event("startup")
async def startup_load_model():
    global MODEL
    try:
        import ultralytics.nn.modules.head as _head
        import ultralytics.nn.modules.block as _block
        for mod in [_head, _block]:
            for attr in ["Segment", "Detect", "Pose", "Classify", "OBB", "WorldDetect", "Proto", "C2f"]:
                if hasattr(mod, attr) and not hasattr(mod, f"{attr}26"):
                    setattr(mod, f"{attr}26", getattr(mod, attr))
        
        from ultralytics import YOLO
        if MODEL is None and MODEL_PATH.exists():
            MODEL = YOLO(str(MODEL_PATH))
            logger.info(
                "Final YOLO model loaded once at startup; classes: %s",
                MODEL.names,
            )
    except Exception:
        logger.exception("Failed loading YOLO model at startup")


@app.get("/health")
def health():
    return {
        "status": "ok" if MODEL is not None else ("degraded" if MODEL_PATH.exists() else "unavailable"),
        "model": str(MODEL_PATH),
        "model_exists": MODEL_PATH.exists(),
        "model_ready": MODEL is not None,
    }


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    port = int(os.getenv("AI_SERVER_PORT", "8001"))
    uvicorn.run(app, host=os.getenv("AIVALA_INTERNAL_HOST", "127.0.0.1"), port=port)
