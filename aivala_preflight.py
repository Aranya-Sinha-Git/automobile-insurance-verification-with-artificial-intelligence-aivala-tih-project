"""Shared preflight checks for the AIVALA local stack.

The checks are intentionally side-effect-light: they inspect the environment,
verify managed executables and model files, and create only the directories the
services already require. Model downloads and dependency installation belong to
``setup_local_ai.py``.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import socket
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_NGROK_PATH = Path(os.environ.get("LOCALAPPDATA", "")) / "ngrok" / "ngrok.exe"
MANAGED_NGROK_PATH = ROOT_DIR / ".tools" / "ngrok" / "ngrok.exe"
MANAGED_FFMPEG_DIR = ROOT_DIR / ".tools" / "ffmpeg" / "bin"
QWEN_ADAPTER_DIR = ROOT_DIR / "models" / "qwen3-vl-4b-car-damage-lora"
QWEN_BASE_MODEL_DIR = ROOT_DIR / "models" / "qwen3-vl-4b-instruct"
YOLO_MODEL_PATH = ROOT_DIR / "final_best.pt"
DB_PATH = ROOT_DIR / "backend" / "backend" / "data" / "aivala_security.sqlite3"


def security_db_path() -> Path:
    """Use the same explicit override as the forensic gateway."""
    configured = os.environ.get("AIVALA_SECURITY_DB", "").strip()
    return Path(configured).expanduser() if configured else DB_PATH
CHECKSUMS_PATH = ROOT_DIR / "model_checksums.json"

REQUIRED_IMPORTS = {
    "fastapi": "fastapi",
    "uvicorn": "uvicorn",
    "python-multipart": "multipart",
    "opencv-python": "cv2",
    "numpy": "numpy",
    "scipy": "scipy",
    "Pillow": "PIL",
    "httpx": "httpx",
    "requests": "requests",
    "imagehash": "imagehash",
    "exifread": "exifread",
    "ultralytics": "ultralytics",
    "transformers": "transformers",
    "qwen-vl-utils": "qwen_vl_utils",
    "peft": "peft",
    "facenet-pytorch": "facenet_pytorch",
    "pyngrok": "pyngrok",
    "torch": "torch",
}


@dataclass(frozen=True)
class Check:
    name: str
    ok: bool
    detail: str
    required: bool = True


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def load_local_environment() -> None:
    """Load .env.local for direct preflight invocation; never override process env."""
    path = ROOT_DIR / ".env.local"
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _first_existing(paths: Iterable[Path]) -> Path | None:
    for path in paths:
        if path.is_file():
            return path.resolve()
    return None


def resolve_executable(name: str, env_name: str, managed: Path) -> Path | None:
    configured = os.environ.get(env_name, "").strip()
    candidates = [Path(configured)] if configured else []
    candidates.append(managed)
    if name == "ngrok.exe":
        candidates.extend([DEFAULT_NGROK_PATH, Path.home() / ".ngrok2" / name])
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    found = shutil_which(name)
    return Path(found).resolve() if found else None


def shutil_which(name: str) -> str | None:
    # Kept local so importing this module never imports application dependencies.
    import shutil

    return shutil.which(name)


def configure_media_path() -> None:
    """Make managed FFmpeg discoverable by OpenCV helpers and subprocesses."""
    ffmpeg_dir = os.environ.get("AIVALA_FFMPEG_DIR", "").strip()
    directory = Path(ffmpeg_dir) if ffmpeg_dir else MANAGED_FFMPEG_DIR
    if directory.is_dir():
        current = os.environ.get("PATH", "").split(os.pathsep)
        if str(directory) not in current:
            os.environ["PATH"] = str(directory) + os.pathsep + os.environ.get("PATH", "")
        ffmpeg_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
        ffprobe_name = "ffprobe.exe" if os.name == "nt" else "ffprobe"
        if (directory / ffmpeg_name).is_file():
            os.environ.setdefault("AIVALA_FFMPEG_BIN", str((directory / ffmpeg_name).resolve()))
        if (directory / ffprobe_name).is_file():
            os.environ.setdefault("AIVALA_FFPROBE_BIN", str((directory / ffprobe_name).resolve()))


def find_local_hf_model(repo_id: str, explicit: str | None = None) -> Path | None:
    """Find a complete local Hugging Face snapshot without touching the network."""
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit).expanduser())
    candidates.append(QWEN_BASE_MODEL_DIR)

    hf_home = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))
    repo_cache = hf_home / "hub" / ("models--" + repo_id.replace("/", "--")) / "snapshots"
    if repo_cache.is_dir():
        candidates.extend(sorted(repo_cache.iterdir(), reverse=True))

    for candidate in candidates:
        if not candidate.is_dir():
            continue
        # Qwen VL needs model config plus processor/tokenizer assets. This is a
        # conservative readiness check, not a full model load.
        has_weights = any(candidate.glob("*.safetensors")) or (candidate / "pytorch_model.bin").is_file()
        if (candidate / "config.json").is_file() and has_weights and (
            (candidate / "preprocessor_config.json").is_file()
            or (candidate / "processor_config.json").is_file()
        ):
            return candidate.resolve()
    return None


def _run_version(executable: Path, args: list[str]) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            [str(executable), *args],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        output = (result.stdout or result.stderr or "").strip().splitlines()
        return result.returncode == 0, output[0][:180] if output else f"exit code {result.returncode}"
    except Exception as exc:
        return False, str(exc)


def _port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _model_checks() -> list[Check]:
    checks: list[Check] = []
    if YOLO_MODEL_PATH.is_file() and YOLO_MODEL_PATH.stat().st_size > 1_000_000:
        checks.append(Check("YOLO weights", True, f"{YOLO_MODEL_PATH.name} ({YOLO_MODEL_PATH.stat().st_size:,} bytes)"))
    else:
        checks.append(Check("YOLO weights", False, f"missing or too small: {YOLO_MODEL_PATH}"))

    required_adapter = ["adapter_config.json", "adapter_model.safetensors", "tokenizer.json"]
    missing = [name for name in required_adapter if not (QWEN_ADAPTER_DIR / name).is_file()]
    if missing:
        checks.append(Check("Qwen adapter", False, f"missing {', '.join(missing)} in {QWEN_ADAPTER_DIR}"))
    else:
        try:
            config = json.loads((QWEN_ADAPTER_DIR / "adapter_config.json").read_text(encoding="utf-8"))
            base = config.get("base_model_name_or_path")
            if base != os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen3-VL-4B-Instruct"):
                checks.append(Check("Qwen adapter metadata", False, f"base model is {base!r}, expected configured model"))
            else:
                checks.append(Check("Qwen adapter", True, f"adapter_model.safetensors ({(QWEN_ADAPTER_DIR / 'adapter_model.safetensors').stat().st_size:,} bytes)"))
        except Exception as exc:
            checks.append(Check("Qwen adapter metadata", False, str(exc)))

    repo_id = os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen3-VL-4B-Instruct")
    base = find_local_hf_model(repo_id, os.environ.get("QWEN_BASE_MODEL_PATH"))
    if base:
        checks.append(Check("Qwen base model cache", True, str(base)))
        os.environ["QWEN_BASE_MODEL_PATH"] = str(base)
        os.environ["HF_HUB_OFFLINE"] = "1"
    else:
        # Do not leave an inherited HF_HUB_OFFLINE=1 active when the cache is
        # absent; setup_local_ai.py can download the model in online mode.
        os.environ.pop("HF_HUB_OFFLINE", None)
        checks.append(Check("Qwen base model cache", False, f"no complete local snapshot for {repo_id}; run setup_local_ai.py"))

    if CHECKSUMS_PATH.is_file():
        try:
            expected = json.loads(CHECKSUMS_PATH.read_text(encoding="utf-8"))
            for relative, expected_hash in expected.items():
                target = ROOT_DIR / relative
                if not target.is_file():
                    checks.append(Check(f"Checksum {relative}", False, "file missing"))
                else:
                    actual = _hash_file(target)
                    checks.append(Check(f"Checksum {relative}", actual == str(expected_hash).upper(), actual))
        except Exception as exc:
            checks.append(Check("Model checksum manifest", False, str(exc)))
    return checks


def run_preflight(*, strict: bool = True, check_ports: bool = True) -> bool:
    """Print and return the result of all local launch checks."""
    load_local_environment()
    configure_media_path()
    checks: list[Check] = []
    checks.append(Check("Python", sys.version_info >= (3, 10), sys.version.split()[0]))
    checks.append(Check("QWEN_MODEL_ID", bool(os.environ.get("QWEN_MODEL_ID", "").strip()), os.environ.get("QWEN_MODEL_ID", "") or "missing"))
    checks.append(Check("AIVALA_ALLOWED_ORIGINS", bool(os.environ.get("AIVALA_ALLOWED_ORIGINS", "").strip()), "configured" if os.environ.get("AIVALA_ALLOWED_ORIGINS", "").strip() else "missing"))

    for package, module in REQUIRED_IMPORTS.items():
        found = importlib.util.find_spec(module) is not None
        required = not (package == "facenet-pytorch")
        checks.append(Check(f"Import {package}", found, "available" if found else "not installed", required=required))

    try:
        import torch

        cuda = bool(torch.cuda.is_available())
        cuda_detail = f"{torch.cuda.get_device_name(0)} / CUDA {torch.version.cuda}" if cuda else "CUDA unavailable (CPU only)"
        checks.append(Check("PyTorch CUDA", cuda or not _truthy(os.environ.get("QWEN_LOAD_IN_4BIT")), cuda_detail, required=_truthy(os.environ.get("QWEN_LOAD_IN_4BIT"))))
    except Exception as exc:
        checks.append(Check("PyTorch CUDA", False, str(exc)))

    if check_ports:
        for port in (7860, 8001, 8000):
            available = _port_available(port)
            checks.append(Check(f"Port {port}", available, "available" if available else "already in use"))

    checks.extend(_model_checks())

    ffmpeg = resolve_executable("ffmpeg.exe" if os.name == "nt" else "ffmpeg", "AIVALA_FFMPEG_BIN", MANAGED_FFMPEG_DIR / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"))
    ffprobe = resolve_executable("ffprobe.exe" if os.name == "nt" else "ffprobe", "AIVALA_FFPROBE_BIN", MANAGED_FFMPEG_DIR / ("ffprobe.exe" if os.name == "nt" else "ffprobe"))
    require_media_tools = _truthy(os.environ.get("AIVALA_REQUIRE_FFMPEG"))
    for label, executable in (("FFmpeg", ffmpeg), ("FFprobe", ffprobe)):
        if executable:
            ok, detail = _run_version(executable, ["-version"])
            checks.append(Check(label, ok, f"{executable} | {detail}", required=require_media_tools))
        else:
            checks.append(Check(label, False, "not found; OpenCV metadata fallback remains active", required=require_media_tools))

    tunnel_enabled = _truthy(os.environ.get("AIVALA_ENABLE_TUNNEL")) and not _truthy(os.environ.get("AIVALA_SKIP_TUNNEL"))
    ngrok = resolve_executable("ngrok.exe" if os.name == "nt" else "ngrok", "NGROK_PATH", MANAGED_NGROK_PATH)
    if ngrok:
        ok, detail = _run_version(ngrok, ["version"])
        checks.append(Check("ngrok", ok, f"{ngrok} | {detail}", required=tunnel_enabled))
    else:
        checks.append(Check("ngrok", False, "not found; setup will install the managed binary", required=tunnel_enabled))
    token = os.environ.get("NGROK_AUTHTOKEN", "").strip()
    checks.append(Check("NGROK_AUTHTOKEN", bool(token) and len(token) >= 16, "configured (value hidden)" if token else "missing", required=tunnel_enabled))
    domain = os.environ.get("NGROK_DOMAIN", "").strip()
    checks.append(Check("NGROK_DOMAIN", bool(domain), domain or "missing; configure the persistent dev domain", required=tunnel_enabled))

    try:
        resolved_db = security_db_path()
        resolved_db.parent.mkdir(parents=True, exist_ok=True)
        probe = resolved_db.with_suffix(resolved_db.suffix + ".preflight")
        probe.write_text("preflight", encoding="utf-8")
        probe.unlink()
        checks.append(Check("Database directory", True, str(resolved_db.parent)))
    except Exception as exc:
        checks.append(Check("Database directory", False, str(exc)))
    for directory in (ROOT_DIR / "backend" / "backend" / "data", ROOT_DIR / ".tools", ROOT_DIR / "AIVALA_V3"):
        try:
            directory.mkdir(parents=True, exist_ok=True)
            probe = directory / ".aivala-write-test"
            probe.write_text("preflight", encoding="utf-8")
            probe.unlink()
            writable = True
        except Exception:
            writable = False
        checks.append(Check(f"Writable {directory.name}", writable, str(directory), required=True))

    print("AIVALA local preflight")
    print("=" * 72)
    for check in checks:
        marker = "PASS" if check.ok else ("WARN" if not check.required else "FAIL")
        print(f"[{marker}] {check.name}: {check.detail}")
    # Optional capabilities (currently FFmpeg/FFprobe and facenet-pytorch) may
    # be absent in the prototype. Only explicitly required checks block launch.
    failures = [check for check in checks if not check.ok and check.required]
    print("=" * 72)
    print("Preflight PASSED" if not failures else f"Preflight FAILED ({len(failures)} blocking check(s))")
    return not failures


if __name__ == "__main__":
    raise SystemExit(0 if run_preflight() else 1)
