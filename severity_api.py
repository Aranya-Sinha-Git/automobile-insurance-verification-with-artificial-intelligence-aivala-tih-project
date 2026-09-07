from __future__ import annotations

import base64
import io
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Configure UTF-8 encoding for Windows standard output
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_ID = os.getenv("QWEN_MODEL_ID", "Qwen/Qwen3-VL-4B-Instruct")
BASE_MODEL_PATH = os.getenv("QWEN_BASE_MODEL_PATH", "").strip()
MODEL_SOURCE = str(Path(BASE_MODEL_PATH).expanduser().resolve()) if BASE_MODEL_PATH else MODEL_ID
DEVICE_MAP = os.getenv("QWEN_DEVICE_MAP", "auto")
ADAPTER_PATH = Path(
    os.getenv(
        "QWEN_ADAPTER_PATH",
        str(Path(__file__).resolve().parent / "models" / "qwen3-vl-4b-car-damage-lora"),
    )
).resolve()
LOAD_IN_4BIT = os.getenv("QWEN_LOAD_IN_4BIT", "1").strip().lower() not in {"0", "false", "no"}
MAX_NEW_TOKENS = int(os.getenv("QWEN_MAX_NEW_TOKENS", "192"))
MIN_IMAGE_PIXELS = int(os.getenv("QWEN_MIN_IMAGE_PIXELS", str(128 * 128)))
# Match the image resolution used for the QLoRA training set.  This cuts visual
# token work substantially while retaining the resolution the adapter learned.
MAX_IMAGE_PIXELS = int(os.getenv("QWEN_MAX_IMAGE_PIXELS", str(320 * 320)))

SEVERITY_SCHEMA = {
    "none": [
        "No damage visible",
        "False detection",
    ],
    "minor": [
        "Cosmetic damage only",
        "Small area affected",
    ],
    "semi_minor": [
        "More than a superficial mark",
        "Limited repair may be needed",
    ],
    "moderate": [
        "Visible deformation",
        "Repair likely required",
    ],
    "semi_moderate": [
        "Substantial visible deformation",
        "Repair is clearly required",
    ],
    "semi_severe": [
        "Major damage with partial component failure",
        "Extensive repair or likely replacement needed",
    ],
    "severe": [
        "Major deformation",
        "Part replacement likely",
    ],
}

app = FastAPI(title="Local Qwen Severity API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DetectionPayload(BaseModel):
    detection_id: str
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: list[float]
    image: str = Field(..., description="data:image/jpeg;base64,...")


class DamageContextPayload(BaseModel):
    location: str = "unspecified"
    parts_count: int = Field(default=1, ge=1, le=12)
    extent: str = "localized"
    reported_damage_type: str = "unspecified"
    incident_description: str = ""


class SeverityRequest(BaseModel):
    model: str | None = None
    severity_schema: dict[str, list[str]] | None = None
    damage_context: DamageContextPayload = Field(default_factory=DamageContextPayload)
    detections: list[DetectionPayload]


class SeverityResult(BaseModel):
    detection_id: str
    severity: str
    note: str
    vlm_reasoning: list[str] = Field(default_factory=list)
    screen_recording_suspected: bool = False
    screen_recording_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    screen_recording_evidence: list[str] = Field(default_factory=list)


class SeverityResponse(BaseModel):
    results: list[SeverityResult]


@dataclass
class Runtime:
    processor: Any | None = None
    model: Any | None = None
    ready: bool = False


runtime = Runtime()


def _normalize_severity(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in SEVERITY_SCHEMA:
        return text
    raise ValueError(f"VLM returned invalid severity: {value!r}")


def _normalize_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"true", "yes", "1", "flagged"}


def _extract_result_candidates(parsed: Any) -> list[dict[str, Any]]:
    """Accept the QLoRA training schema and the API's legacy response schema."""
    if isinstance(parsed, list):
        candidates = parsed
    elif isinstance(parsed, dict):
        # The fine-tuned data uses `detections`; `results` is retained for
        # compatibility with earlier versions of the severity endpoint.
        candidates = parsed.get("detections", parsed.get("results"))
    else:
        candidates = None
    if not isinstance(candidates, list):
        raise ValueError("VLM JSON did not contain a detections or results array")
    return [candidate for candidate in candidates if isinstance(candidate, dict)]


def _parse_qwen_candidates(output_text: str, expected_ids: set[str]) -> list[dict[str, Any]]:
    """Parse complete responses, or a complete prefix before a repeated tail is cut off."""
    import json

    try:
        return _extract_result_candidates(json.loads(output_text))
    except json.JSONDecodeError as original_error:
        # Qwen can occasionally repeat a valid item rather than emit EOS. Recover
        # only when the leading JSON array contains one complete item for every
        # requested detection ID; never invent or accept a partial item.
        key_index = output_text.find('"detections"')
        array_start = output_text.find("[", key_index)
        if key_index < 0 or array_start < 0:
            raise original_error

        decoder = json.JSONDecoder()
        position = array_start + 1
        recovered: list[dict[str, Any]] = []
        recovered_ids: set[str] = set()
        while position < len(output_text):
            while position < len(output_text) and output_text[position] in " \t\r\n,":
                position += 1
            if position >= len(output_text) or output_text[position] != "{":
                break
            try:
                candidate, position = decoder.raw_decode(output_text, position)
            except json.JSONDecodeError:
                break
            if isinstance(candidate, dict):
                detection_id = str(candidate.get("detection_id", ""))
                if detection_id in expected_ids and detection_id not in recovered_ids:
                    recovered.append(candidate)
                    recovered_ids.add(detection_id)
                    if recovered_ids == expected_ids:
                        return recovered
        raise original_error


def _load_qwen():
    if runtime.ready:
        return runtime.model, runtime.processor

    try:
        import torch
        from peft import PeftModel
        from transformers import AutoProcessor, AutoModelForImageTextToText, BitsAndBytesConfig
        from qwen_vl_utils import process_vision_info
    except Exception as exc:
        raise RuntimeError(
            "Please install `transformers`, `torch`, `accelerate`, `peft`, `bitsandbytes`, and `qwen-vl-utils`."
        ) from exc

    if not ADAPTER_PATH.is_dir():
        raise RuntimeError(f"Fine-tuned QLoRA adapter is missing: {ADAPTER_PATH}")
    if LOAD_IN_4BIT and not torch.cuda.is_available():
        raise RuntimeError("4-bit QLoRA inference requires an NVIDIA CUDA GPU")
    if BASE_MODEL_PATH and not Path(MODEL_SOURCE).is_dir():
        raise RuntimeError(f"Configured Qwen base model path is missing: {MODEL_SOURCE}")
    print(f"Loading fine-tuned {MODEL_ID} from '{MODEL_SOURCE}' with adapter '{ADAPTER_PATH}' on device '{DEVICE_MAP}'...")
    if torch.cuda.is_available():
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True
    model_kwargs: dict[str, Any] = {
        "device_map": DEVICE_MAP,
        "attn_implementation": "sdpa",
    }
    if LOAD_IN_4BIT:
        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.float16,
        )
    else:
        model_kwargs["dtype"] = torch.float16 if torch.cuda.is_available() else torch.float32
    model = AutoModelForImageTextToText.from_pretrained(MODEL_SOURCE, **model_kwargs)
    model = PeftModel.from_pretrained(model, str(ADAPTER_PATH))
    model.eval()
    processor = AutoProcessor.from_pretrained(
        MODEL_SOURCE,
        min_pixels=MIN_IMAGE_PIXELS,
        max_pixels=MAX_IMAGE_PIXELS,
    )
    runtime.model = model
    runtime.processor = processor
    runtime.ready = True
    print("Fine-tuned QLoRA model successfully loaded into memory!")
    return model, processor


def _decode_image(image_data_url: str):
    from PIL import Image

    payload = image_data_url.split(",", 1)[-1]
    raw = base64.b64decode(payload)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _build_prompt(
    detections: list[DetectionPayload],
    severity_schema: dict[str, list[str]],
    damage_context: DamageContextPayload,
) -> str:
    required_records = ",".join(
        f'{{"detection_id":"{det.detection_id}","severity":"<severity>","note":"<note>"}}'
        for det in detections
    )
    lines = [
        "You are Qwen-3.5-VL Vision-Language Model evaluating vehicle damage evidence from a complete video frame.",
        f'Return exactly this JSON structure, replacing only <severity> and <note>: {{"detections":[{required_records}]}}',
        "The array must contain every listed detection ID exactly once. Do not omit a detection because it is not visible; use severity none and a short note for that case. Never repeat an ID.",
        "Each result item MUST include only detection_id, severity, and note.",
        "",
        "CRITICAL VEHICLE VERIFICATION GATE (apply FIRST, before any damage assessment):",
        "Before evaluating damage, confirm that the image clearly shows a car, truck, or recognizable vehicle body part (e.g. bumper, fender, door panel, hood, trunk, quarter panel, wheel arch, side mirror, windshield, headlight, taillight).",
        "If the image does NOT show a vehicle or any recognizable vehicle body part, you MUST set severity to 'none' for ALL detections and set the note to 'Rejected: image does not show a vehicle or vehicle part'.",
        "Do NOT approve damage on non-vehicle objects such as walls, furniture, appliances, random objects, people, animals, or landscapes.",
        "",
        "severity must be one of [none, minor, semi_minor, moderate, semi_moderate, semi_severe, severe].",
        "note must be a visual damage summary of at most 12 words.",
        "Use the claimant's structured answers as supporting context, but report a contradiction if the image does not support them.",
        "Treat frame-level damage as structurally significant and multi-part damage as broader repair scope.",
        "Claimant damage context:",
        f"- vehicle_area={damage_context.location}",
        f"- reported_damaged_parts={damage_context.parts_count}",
        f"- damage_extent={damage_context.extent}",
        f"- reported_damage_type={damage_context.reported_damage_type}",
        f"- incident_description={damage_context.incident_description or 'not provided'}",
        "Severity criteria:",
    ]
    for level, bullets in severity_schema.items():
        lines.append(f"- {level}: {', '.join(bullets)}")
    lines.append("Do not add markdown formatting or extra text outside JSON.")
    lines.append("Detections:")
    for det in detections:
        lines.append(
            f"- id={det.detection_id}; label={det.label}; confidence={det.confidence:.2f}; bbox_normalized_xyxy={det.bbox}"
        )
    return "\n".join(lines)


def _infer_with_qwen(
    detections: list[DetectionPayload],
    severity_schema: dict[str, list[str]],
    damage_context: DamageContextPayload,
) -> list[SeverityResult]:
    try:
        from qwen_vl_utils import process_vision_info
    except Exception as exc:
        raise RuntimeError("qwen_vl_utils is unavailable; VLM severity cannot run") from exc

    import time
    start_all = time.time()
    print(f"[QWEN VLM API] Processing {len(detections)} detections in one full-frame generation...", flush=True)

    model, processor = _load_qwen()
    image_payloads = {det.image for det in detections}
    if len(image_payloads) != 1:
        raise ValueError("Bulk VLM inference requires every detection to originate from one frame")

    image = _decode_image(detections[0].image)
    prompt = _build_prompt(detections, severity_schema, damage_context)
    messages = [{"role": "user", "content": [
        {"type": "image", "image": image},
        {"type": "text", "text": prompt},
    ]}]
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(text=[text], images=image_inputs, videos=video_inputs, return_tensors="pt")

    try:
        import torch

        inputs = {k: v.to(model.device) if hasattr(v, "to") else v for k, v in inputs.items()}
        with torch.inference_mode():
            # Enough room for every compact item without inviting a repeated tail.
            response_token_budget = min(MAX_NEW_TOKENS, 40 * len(detections) + 20)
            generated = model.generate(**inputs, max_new_tokens=response_token_budget, do_sample=False, use_cache=True)
        output_text = processor.batch_decode(
            generated[:, inputs["input_ids"].shape[1] :], skip_special_tokens=True,
        )[0].strip()
        print(f"[QWEN INFERENCE] Completed {len(detections)} detections in {time.time() - start_all:.2f}s", flush=True)
        print(f"   Raw Output: {output_text}", flush=True)
    except Exception as exc:
        raise RuntimeError("Qwen bulk inference failed") from exc

    try:
        candidates = _parse_qwen_candidates(
            output_text,
            {det.detection_id for det in detections},
        )
        candidates_by_id = {
            str(candidate.get("detection_id")): candidate
            for candidate in candidates
            if isinstance(candidate, dict) and candidate.get("detection_id") is not None
        }
    except Exception as exc:
        raise RuntimeError(f"Qwen returned invalid bulk JSON: {output_text[:200]}") from exc

    results: list[SeverityResult] = []
    for det in detections:
        candidate = candidates_by_id.get(det.detection_id)
        if candidate is None:
            raise RuntimeError(f"Qwen result missing for detection {det.detection_id!r}; no guessed severity was assigned.")
        try:
            severity = _normalize_severity(candidate.get("severity"))
            note = str(candidate.get("note") or "").strip()
            if not note:
                raise ValueError("VLM result did not include a note")
            raw_reasoning = candidate.get("vlm_reasoning") or candidate.get("reasoning")
            vlm_reasoning = [str(r) for r in raw_reasoning] if isinstance(raw_reasoning, list) and len(raw_reasoning) == 3 else []
            screen_recording_suspected = _normalize_bool(candidate.get("screen_recording_suspected", False))
            try:
                screen_recording_confidence = max(0.0, min(1.0, float(candidate.get("screen_recording_confidence", 0.0))))
            except (TypeError, ValueError):
                screen_recording_confidence = 0.0
            raw_screen_evidence = candidate.get("screen_recording_evidence") or []
            screen_recording_evidence = [str(item) for item in raw_screen_evidence[:2]] if isinstance(raw_screen_evidence, list) else []
        except Exception as exc:
            raise RuntimeError(f"Qwen returned invalid result for detection {det.detection_id!r}") from exc

        screen_recording_suspected = screen_recording_suspected and screen_recording_confidence >= 0.60
        results.append(SeverityResult(
            detection_id=det.detection_id, severity=severity, note=note,
            vlm_reasoning=vlm_reasoning,
            screen_recording_suspected=screen_recording_suspected,
            screen_recording_confidence=screen_recording_confidence,
            screen_recording_evidence=screen_recording_evidence,
        ))
        print(f"   Resolved {det.detection_id}: severity={severity.upper()} | note='{note}'", flush=True)

    total_time = time.time() - start_all
    print(f"[QWEN VLM API COMPLETE] Total time: {total_time:.2f}s for one frame / {len(detections)} detections.", flush=True)
    return results


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_id": MODEL_ID,
        "base_model_source": MODEL_SOURCE,
        "model_ready": runtime.ready,
        "adapter_path": str(ADAPTER_PATH),
        "quantization": "4-bit NF4" if LOAD_IN_4BIT else "none",
        "max_new_tokens": MAX_NEW_TOKENS,
        "max_image_pixels": MAX_IMAGE_PIXELS,
        "severity_schema": SEVERITY_SCHEMA,
    }


@app.post("/severity", response_model=SeverityResponse)
def severity(payload: SeverityRequest):
    schema = payload.severity_schema or SEVERITY_SCHEMA
    results = _infer_with_qwen(payload.detections, schema, payload.damage_context)
    return SeverityResponse(results=results)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    print(f"Starting Qwen Severity Server on port {port}...")
    _load_qwen()
    uvicorn.run(app, host="0.0.0.0", port=port)
