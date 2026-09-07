# AIVALA - Automated AI Claims & Digital Forensic Audit Pipeline

AIVALA is an automated motor insurance claims processing engine designed to cut settlement timelines from business days down to under 10 minutes. Combining an installable Android mobile application, a FastAPI evidence gateway, a local multi-model computer vision stack (YOLO11 + Qwen VLM), and a 5-layer digital forensic pipeline, the system screens out fraudulent submissions while generating garage-accurate damage valuations automatically.

---

## Key Features

- **5-Layer Forensic Screening**: Prevents fraud via EXIF/GPS audits, perceptual hashing (pHash), Error Level Analysis (ELA), multi-model AI analysis, and SHA-256 cryptographic audit seals.
- **Live In-App Media Recording**: Video capture must be recorded live directly inside the mobile app's camera interface. Uploads from device gallery or pre-recorded external files are strictly disabled to enforce anti-tamper authenticity.
- **Local GPU AI Engine**: Localized object detection and segmentation (YOLO11) paired with Vision-Language Models (Qwen VLM) for fine-grained severity ranking (`Minor`, `Moderate`, `Severe`).
- **Deterministic Valuation Accounting**: Directly translates neural detection tokens into itemized cost estimates using real-world garage rate indexes.
- **Automated Remote Tunnels**: Built-in support for an authenticated ngrok persistent dev domain. SSH fallback is intentionally disabled.

---

## System Architecture

```
 Mobile App (Live Camera Capture)  -->  FastAPI Evidence Gateway (Port 8000)
                                                 |
         +---------------------------------------+---------------------------------------+
         |                                                                               |
         v                                                                               v
 5-Layer Forensic Pipeline (fraud_pipeline.py)                        Deterministic Accounting Engine (expert_system.py)
  - EXIF / GPS Audit                                                   - Itemized Valuation
  - Perceptual Hashing (pHash)                                         - Garage Cost Index Matching
  - Error Level Analysis (ELA)
  - Multi-Model AI Validation
  - SHA-256 Audit Seal Receipts
         |
         +--------------------------------------->  YOLO Damage Inference API (Port 8001)
                                                            |
                                                            v
                                                    Qwen Vision Severity API (Port 7860)
```

---

## Repository Subsystems

| Subsystem / Path | Description |
| --- | --- |
| **`start_local_ai.py`** | Primary launcher that orchestrates Qwen (7860), YOLO (8001), Evidence Gateway (8000), and tunnels. |
| **`severity_api.py`** | Server hosting the fine-tuned Qwen Vision-Language Model for damage severity analysis. |
| **`backend/backend/`** | Canonical FastAPI gateway containing the five-layer engine, legacy mobile compatibility checks, and expert system. |
| **`backend/backend/data/`** | Persistent fingerprint database used by both claim endpoints. |
| **`Huggingface Space files/`** | YOLO damage detection server (`ai_inference_server.py`) powered by `final_best.pt`. |
| **`AIVALA_V3/`** | Mobile application codebase (React, Vite, Capacitor) along with pre-compiled Android APK. |
| **`final_best.pt`** | Trained YOLO object detection and segmentation model weights. |

---

## 5-Layer Forensic Pipeline

1. **Layer 1: EXIF Metadata & Geolocation Audit**
   - Validates smartphone hardware attributes, timestamp vectors, and GPS coordinates against declared location.
2. **Layer 2: Perceptual Hashing (pHash) & Duplicate Shield**
   - Generates multi-strategy perceptual fingerprints across video frames to block recycled or duplicate claims.
3. **Layer 3: Error Level Analysis (ELA) & TruFor Visual Tampering Detection**
   - Analyzes JPEG compression differential ratios and TruFor camera noise residuals (Noiseprint++) to detect visual tampering and splicing.
4. **Layer 4: Deepfake & Claimant Face Liveness Check**
   - Evaluates facial skin texture variance and F3-Net frequency domain anomalies (FAD + LFS) to block AI face swaps and deepfakes.
5. **Layer 5: Local-only Namesake Audit**
   - This deployment does not export evidence frames to a public reverse-image-search provider. The stage is reported as unavailable (`SKIPPED`), never as a clean web-search result.

---

## Quick Start

### 1. Installation
```bash
python setup_local_ai.py
```

`setup_local_ai.py` creates `.venv`, installs the pinned CUDA/runtime dependencies from `requirements.lock`, verifies `final_best.pt` and the Qwen adapter, downloads the Qwen base snapshot when needed, prepares the managed ngrok binary and optionally FFmpeg/FFprobe, and runs preflight checks. Use `--skip-qwen-download`, `--skip-ffmpeg`, or `--skip-ngrok` when those assets are supplied by another deployment step. Missing FFmpeg/FFprobe produces a warning and enables the OpenCV metadata fallback; set `AIVALA_REQUIRE_FFMPEG=1` to make them blocking.

The Qwen adapter is loaded from `models/qwen3-vl-4b-car-damage-lora` by default and the base model is prepared at `models/qwen3-vl-4b-instruct`. Override them with `QWEN_ADAPTER_PATH` or `QWEN_BASE_MODEL_PATH`. Set `NGROK_DOMAIN` in `.env.local` to the persistent dev domain assigned to the account; the launcher validates both that domain and the configured authtoken before reporting success. Set `AIVALA_AUDIT_SECRET` to enable HMAC audit receipts. `DEV_TESTING_MODE` defaults to `false`; set it to `true` only for local media-transfer testing.

### 2. Start Local AI Infrastructure & Gateway
```bash
.venv\\Scripts\\python.exe start_local_ai.py
```
*(On Windows: double-click `launch_gui.vbs` or `start_local_ai.bat`)*

The launcher loads device-local settings from the gitignored `.env.local` file without overriding variables supplied by the parent process. It does not create an external tunnel by default unless `AIVALA_ENABLE_TUNNEL=1`; `AIVALA_SKIP_TUNNEL=1` remains available as an explicit override. Configure browser/native origins with the comma-separated `AIVALA_ALLOWED_ORIGINS` environment variable; the default allows Capacitor localhost and common local development ports.

#### Local Service Endpoints

| Service | Port | Endpoint URL | Description |
| --- | --- | --- | --- |
| **Qwen Severity API** | `7860` | `http://localhost:7860/health` | Vision-Language Model severity engine |
| **YOLO Inference API** | `8001` | `http://localhost:8001/health` | Damage localization & segmentation |
| **Evidence Gateway** | `8000` | `http://localhost:8000/` | FastAPI gateway & 5-layer forensic engine |

---

## Android Mobile Application

The pre-compiled Android debug binary is located at `AIVALA_V3/app-debug.apk`.

1. Install `AIVALA_V3/app-debug.apk` on your Android device.
2. Ensure local services are running (`python start_local_ai.py`).
3. Open **Settings** in the app and set the **AI Server URL** to the HTTPS Tunnel URL printed by the launcher (or `http://localhost:8000` for emulator access).

> **Important**: Uploads from the device gallery or external files are strictly disabled. Video media must be recorded live in-app.

### Rebuilding the Android APK (Optional)
```bash
cd AIVALA_V3
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

---

## Troubleshooting

- **GPU Acceleration**: Ensure NVIDIA drivers and PyTorch CUDA support are properly installed for real-time model performance.
- **Port Conflicts**: Verify ports `7860`, `8001`, and `8000` are unblocked before launching `start_local_ai.py`.
- **ngrok authentication/domain**: Configure `NGROK_AUTHTOKEN` and `NGROK_DOMAIN` in `.env.local`. A missing or invalid persistent domain stops startup so the mobile app is never pointed at an unverified endpoint.
- **FFmpeg/FFprobe**: Run `python setup_local_ai.py` to install the managed Windows build when full container metadata is needed. They are optional for the prototype; without FFprobe, OpenCV metadata fallback is used.
- **Face detector**: `facenet-pytorch==2.6.0` is pinned separately for later installation. The prototype uses the verified OpenCV YuNet/ONNX/Haar fallback and reports that reduced detector mode in preflight.
- **Bundled Python dependencies**: The checked-in `.vendor` directory is not used by default because it may contain platform-specific binaries. Set `AIVALA_USE_VENDOR_DEPS=1` only when that bundle has been rebuilt for the current machine.
- **Release signing**: Release APKs require `AIVALA_RELEASE_KEYSTORE_PATH`, `AIVALA_RELEASE_KEYSTORE_PASSWORD`, `AIVALA_RELEASE_KEY_ALIAS`, and `AIVALA_RELEASE_KEY_PASSWORD`. No signing credentials are stored in this project.
