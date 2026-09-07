"""AIVALA Standalone Fraud Detection API Server.

Exposes the 5-layer digital forensics fraud detection pipeline via:
- POST /verify-claim
- POST /verify-claim/
- POST /api/v1/fraud-check
- POST /api/v1/fraud-check/
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
import hashlib
import json
import uuid
from pathlib import Path
from typing import Any, List

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

try:
    import av
except ImportError:
    av = None

try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None

from fraud_pipeline import (
    AivalaFraudPipeline,
    _connect,
    fingerprint_video,
    get_all_historical_phashes,
    store_fingerprint,
)
from legacy_evidence import generate_audit_receipt
from auth import require_operator

logger = logging.getLogger("AivalaFraudAPI")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="AIVALA Standalone 5-Layer Fraud Detection Server")

_default_origins = "capacitor://localhost,http://localhost,https://localhost,http://localhost:3000,http://localhost:5173"
_allowed_origins = [origin.strip() for origin in os.getenv("AIVALA_ALLOWED_ORIGINS", _default_origins).split(",") if origin.strip()]
if "*" in _allowed_origins:
    raise RuntimeError("AIVALA_ALLOWED_ORIGINS cannot contain '*' when credentialed browser access is enabled")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "ngrok-skip-browser-warning"],
)

# Initialize pipeline and load historical pHash DB from persistent SQLite database
fraud_pipeline = AivalaFraudPipeline()
try:
    historical_phash_db: List[str] = get_all_historical_phashes()
    logger.info(f"Loaded {len(historical_phash_db)} historical pHashes from SQLite database")
except Exception as db_init_err:
    logger.warning(f"Could not load historical pHashes from SQLite: {db_init_err}")
    historical_phash_db: List[str] = []

@app.on_event("startup")
def startup_event():
    global historical_phash_db
    try:
        historical_phash_db = get_all_historical_phashes()
        logger.info(f"Startup: Loaded {len(historical_phash_db)} pHash records from SQLite DB")
    except Exception as exc:
        logger.warning(f"Startup DB load error: {exc}")


def _safe_inference_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or not isinstance(payload.get("detections"), list):
        raise ValueError("missing detections")
    for detection in payload["detections"]:
        if not isinstance(detection, dict) or not isinstance(detection.get("bbox"), list) or len(detection["bbox"]) != 4:
            raise ValueError("malformed detection")
    return payload


async def _forward_to_inference(path: str, filename: str, content_type: str | None, context: dict[str, str]) -> dict[str, Any]:
    """Call the private YOLO/Qwen service and reject malformed upstream data."""
    timeout = httpx.Timeout(connect=15.0, read=240.0, write=60.0, pool=15.0)
    url = os.getenv("AI_INFERENCE_SERVER_URL", "http://127.0.0.1:8001/analyze-video").strip()
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            with open(path, "rb") as evidence:
                response = await client.post(url, files={"file": (filename, evidence, content_type or "video/mp4")}, data=context)
        if response.status_code >= 500:
            raise RuntimeError("upstream unavailable")
        if response.status_code >= 400:
            raise ValueError("upstream rejected evidence")
        return _safe_inference_payload(response.json())
    except httpx.TimeoutException as exc:
        raise TimeoutError("inference timeout") from exc
    except httpx.RequestError as exc:
        raise RuntimeError("inference connection failed") from exc
    except (json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError("invalid inference response") from exc


def _convert_webm_to_mp4(src: str, dst: str) -> bool:
    """Converts a .webm video to .mp4 using PyAV or imageio-ffmpeg.

    Guarantees OpenCV cv2.VideoCapture extracts frames cleanly without
    system binary dependencies on macOS.
    """
    # Strategy 1: PyAV direct stream decoding and H.264 muxing
    if av is not None:
        try:
            container_in = av.open(src)
            video_stream_in = next((s for s in container_in.streams if s.type == 'video'), None)
            if video_stream_in:
                container_out = av.open(dst, mode='w', format='mp4')
                fps = video_stream_in.average_rate or 30
                video_stream_out = container_out.add_stream('h264', rate=fps)
                video_stream_out.width = video_stream_in.codec_context.width or 1280
                video_stream_out.height = video_stream_in.codec_context.height or 720
                video_stream_out.pix_fmt = 'yuv420p'

                for packet in container_in.demux(video_stream_in):
                    for frame in packet.decode():
                        for out_packet in video_stream_out.encode(frame):
                            container_out.mux(out_packet)

                for out_packet in video_stream_out.encode():
                    container_out.mux(out_packet)

                container_out.close()
                container_in.close()

                if os.path.exists(dst) and os.path.getsize(dst) > 0:
                    logger.info(f"PyAV successfully converted {src} to {dst}")
                    return True
        except Exception as pyav_err:
            logger.warning(f"PyAV conversion attempt notice: {pyav_err}")

    # Strategy 2: Standalone imageio-ffmpeg executable
    if imageio_ffmpeg is not None:
        try:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            cmd = [ffmpeg_exe, "-y", "-i", src, "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", dst]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0 and os.path.exists(dst) and os.path.getsize(dst) > 0:
                logger.info(f"imageio-ffmpeg successfully converted {src} to {dst}")
                return True
        except Exception as img_err:
            logger.warning(f"imageio-ffmpeg conversion attempt notice: {img_err}")

    # Strategy 3: System ffmpeg CLI
    try:
        cmd_sys = ["ffmpeg", "-y", "-i", src, "-c:v", "libx264", "-preset", "ultrafast", dst]
        res_sys = subprocess.run(cmd_sys, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res_sys.returncode == 0 and os.path.exists(dst) and os.path.getsize(dst) > 0:
            return True
    except Exception:
        pass

    return False


@app.get("/")
def read_root():
    return {
        "status": "AIVALA 5-Layer Fraud Detection Server Operational",
        "historical_records": len(historical_phash_db),
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "AIVALA Standalone Fraud Detection Backend",
    }


@app.get("/tracking-logs/")
def get_all_logs(authorization: str | None = Header(None), limit: int = 50, offset: int = 0):
    """Operator-only, process-local transaction history without evidence data."""
    require_operator(authorization)
    bounded_limit = min(max(limit, 1), 100)
    records = list(CLAIM_HISTORY_LEDGER.values())[max(offset, 0):max(offset, 0) + bounded_limit]
    return {"total_records": len(CLAIM_HISTORY_LEDGER), "records": records, "offset": max(offset, 0), "limit": bounded_limit}


@app.post("/verify-claim")
@app.post("/verify-claim/")
@app.post("/api/v1/fraud-check")
@app.post("/api/v1/fraud-check/")
async def verify_claim(
    file: UploadFile = File(None),
    video: UploadFile = File(None),
    claim_id: str = Form(None),
    incident_datetime: str = Form(None),
    damage_location: str = Form(None),
    damaged_parts_count: str = Form(None),
    damage_extent: str = Form(None),
    reported_damage_type: str = Form(None),
    incident_description: str = Form(None),
    latitude: str = Form(None),
    longitude: str = Form(None),
    vehicle_number: str = Form(None),
):
    """5-Layer Digital Forensics Fraud Detection & Verification Endpoint."""
    upload_file = file or video
    temp_path: str | None = None
    converted_mp4_path: str | None = None
    current_claim_id = "UNKNOWN"
    request_id = str(uuid.uuid4())

    try:
        if not upload_file or (file is not None and video is not None):
            logger.error("Neither 'file' nor 'video' field was sent in multipart form data")
            return JSONResponse(
                status_code=400,
                content={
                    "status": "REJECTED_FRAUD",
                    "request_id": request_id,
                    "error_code": "EXACTLY_ONE_FILE_REQUIRED",
                    "reason": "Send exactly one evidence video using the 'file' or 'video' form field.",
                },
            )

        cid_clean = re.sub(r"[^A-Za-z0-9_-]", "", str(claim_id or ""))[:80]
        current_claim_id = cid_clean if cid_clean else f"CLM-LOCAL-{int(time.time() * 1000)}"
        CLAIM_HISTORY_LEDGER[request_id] = {"request_id": request_id, "claim_id": current_claim_id, "state": "UPLOADING", "received_at": time.time()}
        filename = upload_file.filename or "evidence.mp4"
        suffix = Path(filename).suffix.lower() or ".mp4"

        with tempfile.NamedTemporaryFile(prefix="aivala_fraud_", suffix=suffix, delete=False) as target:
            temp_path = target.name
            while chunk := await upload_file.read(1024 * 1024):
                target.write(chunk)

        if not temp_path or os.path.getsize(temp_path) == 0:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "REJECTED_FRAUD",
                    "failed_layer": 1,
                    "reason": "Uploaded video file is empty (0 bytes)",
                },
            )

        # Convert .webm to .mp4 using PyAV / imageio-ffmpeg in threadpool to prevent blocking OpenCV
        original_sha256 = hashlib.sha256(Path(temp_path).read_bytes()).hexdigest()
        audit_target_path = temp_path
        analysis_filename = filename
        analysis_content_type = upload_file.content_type or "video/mp4"
        if temp_path.lower().endswith(".webm") or suffix == ".webm":
            mp4_target = temp_path.rsplit(".", 1)[0] + "_converted.mp4"
            ok = await run_in_threadpool(_convert_webm_to_mp4, temp_path, mp4_target)
            if ok:
                converted_mp4_path = mp4_target
                audit_target_path = converted_mp4_path
                analysis_filename = f"{Path(filename).stem}.mp4"
                analysis_content_type = "video/mp4"
                logger.info(f"Successfully converted WebM to MP4: {audit_target_path}")

        logger.info(f"Executing 5-layer audit on target file {audit_target_path} for claim {current_claim_id}")

        # Run CPU-heavy 5-layer audit in worker threadpool
        audit_result = await run_in_threadpool(
            fraud_pipeline.run_5_layer_audit, audit_target_path, historical_phash_db, damage_location or None
        )
        CLAIM_HISTORY_LEDGER[request_id]["state"] = "FORENSICS_COMPLETE"

        if not audit_result.get("passed"):
            failed_layer = audit_result.get("failed_layer", 1)
            internal_reason = audit_result.get("reason", "Failed forensic verification")
            # Log exact internal layer failure for server debugging
            logger.warning(f"INTERNAL AUDIT REJECTION: Claim {current_claim_id} rejected at layer {failed_layer}: {internal_reason}")
            
            # User-facing security generic reason (hides internal layer specifics)
            generic_user_reason = "Verification Failed: Evidence video did not pass security verification guidelines. Please record a new video."
            
            return JSONResponse(
                status_code=400,
                content={
                    "status": "REJECTED_FRAUD",
                    "request_id": request_id,
                    "failed_layer": failed_layer,
                    "error_code": audit_result.get("error_code", "FORENSIC_REJECTED"),
                    "reason": generic_user_reason,
                    "security_pipeline": audit_result.get("security_pipeline", {}),
                },
            )

        new_phash = audit_result.get("phash", "")
        if new_phash and new_phash not in historical_phash_db:
            historical_phash_db.append(new_phash)

        context = {
            "claim_id": current_claim_id,
            "incident_datetime": incident_datetime or "",
            "damage_location": damage_location or "unspecified",
            "damaged_parts_count": damaged_parts_count or "1",
            "damage_extent": damage_extent or "localized",
            "reported_damage_type": reported_damage_type or "unspecified",
            "incident_description": incident_description or "",
        }
        try:
            ai_result = await _forward_to_inference(audit_target_path, analysis_filename, analysis_content_type, context)
        except TimeoutError:
            return JSONResponse(status_code=504, content={"status": "INFRA_FAILURE", "claim_id": current_claim_id, "request_id": request_id, "error_code": "INFERENCE_TIMEOUT", "reason": "Damage analysis timed out. Your evidence can be retried.", "security_pipeline": audit_result.get("security_pipeline", {})})
        except (ValueError, RuntimeError):
            return JSONResponse(status_code=503, content={"status": "INFRA_FAILURE", "claim_id": current_claim_id, "request_id": request_id, "error_code": "INFERENCE_UNAVAILABLE", "reason": "Damage analysis is temporarily unavailable. Your evidence can be retried.", "security_pipeline": audit_result.get("security_pipeline", {})})
        CLAIM_HISTORY_LEDGER[request_id]["state"] = "INFERENCE_COMPLETE"

        # Final persistence is a required terminal step: never report approval if it fails.
        try:
            fp_dict = fingerprint_video(audit_target_path)
            receipt_payload = {
                "schema_version": 2,
                "claim_id": current_claim_id,
                "original_sha256": original_sha256,
                "analysis_sha256": hashlib.sha256(Path(audit_target_path).read_bytes()).hexdigest(),
                "damage_context": context,
                "forensic_outcomes": audit_result.get("security_pipeline", {}),
                "inference_sha256": hashlib.sha256(json.dumps(ai_result, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
                "decision": "NO_DAMAGE" if not ai_result.get("detections") else "APPROVED_AUTHENTIC",
            }
            with _connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                store_fingerprint(current_claim_id, fp_dict, connection=connection)
                receipt = generate_audit_receipt(current_claim_id, receipt_payload, connection=connection)
                connection.commit()
            logger.info(f"Successfully stored fingerprint for claim {current_claim_id} in SQLite database")
        except Exception as fp_err:
            logger.exception("Could not save fingerprint for claim %s", current_claim_id)
            return JSONResponse(status_code=503, content={"status": "INFRA_FAILURE", "claim_id": current_claim_id, "request_id": request_id, "error_code": "PERSISTENCE_FAILURE", "reason": "Verification could not be finalized. Your evidence can be retried.", "security_pipeline": audit_result.get("security_pipeline", {})})

        outcome = "NO_DAMAGE" if not ai_result.get("detections") else "APPROVED_AUTHENTIC"
        CLAIM_HISTORY_LEDGER[request_id]["state"] = outcome
        logger.info("Claim %s completed with %s", current_claim_id, outcome)
        return {
            "status": outcome,
            "claim_id": current_claim_id,
            "request_id": request_id,
            "phash": new_phash,
            "message": "Forensic verification and damage analysis completed",
            "ai_result": ai_result,
            "security_pipeline": audit_result.get("security_pipeline", {}),
            "original_evidence": {"sha256": original_sha256, "filename": filename},
            "analysis_evidence": {"sha256": hashlib.sha256(Path(audit_target_path).read_bytes()).hexdigest(), "filename": analysis_filename, "content_type": analysis_content_type, "converted": bool(converted_mp4_path)},
            "cryptographic_audit": receipt,
        }

    except Exception:
        logger.exception("Unhandled verification error for claim=%s request=%s", current_claim_id, request_id)
        return JSONResponse(
            status_code=500,
            content={
                "status": "INFRA_FAILURE",
                "claim_id": current_claim_id,
                "request_id": request_id,
                "error_code": "PROCESSING_FAILURE",
                "reason": "Verification could not be completed. Your evidence can be retried.",
            },
        )
    finally:
        if upload_file:
            try:
                await upload_file.close()
            except Exception:
                pass
        for p in (temp_path, converted_mp4_path):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass
