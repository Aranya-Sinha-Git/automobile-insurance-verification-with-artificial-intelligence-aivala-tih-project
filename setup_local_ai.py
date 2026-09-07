"""One-command setup for the AIVALA local Windows/GPU stack.

Run with the system Python from the repository root:

    python setup_local_ai.py

The script creates ``.venv``, installs the canonical lock, downloads the
managed ngrok and FFmpeg binaries, downloads the Qwen base snapshot when it is
not already cached, verifies the checked-in adapter/YOLO assets, and finishes
with the same preflight used by the launcher. The optional face detector is
not installed by default; the OpenCV fallback is sufficient for the prototype.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
VENV_DIR = ROOT_DIR / ".venv"
LOCK_FILE = ROOT_DIR / "requirements.lock"
TOOLS_DIR = ROOT_DIR / ".tools"
NGROK_PATH = TOOLS_DIR / "ngrok" / ("ngrok.exe" if os.name == "nt" else "ngrok")
NGROK_CONFIG = TOOLS_DIR / "ngrok" / "ngrok.yml"
FFMPEG_DIR = TOOLS_DIR / "ffmpeg" / "bin"
FFMPEG_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
QWEN_REPO = "Qwen/Qwen3-VL-4B-Instruct"
QWEN_DIR = ROOT_DIR / "models" / "qwen3-vl-4b-instruct"


def _venv_python() -> Path:
    return VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _load_env_file() -> None:
    path = ROOT_DIR / ".env.local"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'") )


def _download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "AIVALA-local-setup/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _download_ffmpeg() -> None:
    ffmpeg_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    ffprobe_name = "ffprobe.exe" if os.name == "nt" else "ffprobe"
    if (FFMPEG_DIR / ffmpeg_name).is_file() and (FFMPEG_DIR / ffprobe_name).is_file():
        print(f"[+] FFmpeg already prepared at {FFMPEG_DIR}")
        return
    archive = Path(tempfile.gettempdir()) / "aivala-ffmpeg-release-essentials.zip"
    checksum_file = archive.with_suffix(".sha256")
    print("[*] Downloading FFmpeg essentials build...")
    _download(FFMPEG_URL, archive)
    _download(FFMPEG_URL + ".sha256", checksum_file)
    expected = checksum_file.read_text(encoding="utf-8").strip().split()[0].upper()
    actual = _sha256(archive)
    if actual != expected:
        raise RuntimeError(f"FFmpeg archive checksum mismatch: expected {expected}, got {actual}")
    with tempfile.TemporaryDirectory(prefix="aivala-ffmpeg-") as extracted_text:
        extracted = Path(extracted_text)
        with zipfile.ZipFile(archive) as bundle:
            for member in bundle.infolist():
                target = (extracted / member.filename).resolve()
                if not str(target).startswith(str(extracted.resolve()) + os.sep):
                    raise RuntimeError(f"Unsafe FFmpeg archive member: {member.filename}")
            bundle.extractall(extracted)
        binaries = list(extracted.rglob(ffmpeg_name))
        probes = list(extracted.rglob(ffprobe_name))
        if not binaries or not probes:
            raise RuntimeError("FFmpeg archive did not contain both ffmpeg and ffprobe")
        FFMPEG_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(binaries[0], FFMPEG_DIR / ffmpeg_name)
        shutil.copy2(probes[0], FFMPEG_DIR / ffprobe_name)
    print(f"[+] FFmpeg and FFprobe installed at {FFMPEG_DIR}")


def _install_ngrok() -> None:
    print("[*] Preparing the pyngrok-managed ngrok binary...")
    sys.path.insert(0, str(_venv_python().parent.parent / "Lib" / "site-packages"))
    from pyngrok import conf, ngrok

    existing_ngrok = Path(os.environ.get("LOCALAPPDATA", "")) / "ngrok" / "ngrok.exe"
    target_ngrok = existing_ngrok if existing_ngrok.is_file() else NGROK_PATH
    target_ngrok.parent.mkdir(parents=True, exist_ok=True)
    config = conf.PyngrokConfig(
        ngrok_path=str(target_ngrok),
        config_path=str(target_ngrok.parent / "ngrok.yml") if existing_ngrok.is_file() else str(NGROK_CONFIG),
        ngrok_version="3",
    )
    ngrok.install_ngrok(config)
    if not target_ngrok.is_file():
        raise RuntimeError(f"pyngrok did not install ngrok at {target_ngrok}")
    result = subprocess.run([str(target_ngrok), "version"], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Managed ngrok verification failed: {(result.stderr or result.stdout).strip()}")
    print(f"[+] Managed ngrok verified: {(result.stdout or result.stderr).strip()}")
    token = os.environ.get("NGROK_AUTHTOKEN", "").strip()
    if token:
        ngrok.set_auth_token(token, config)
        check = subprocess.run(
            [str(target_ngrok), "config", "check", "--config", str(config.config_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if check.returncode != 0:
            raise RuntimeError(f"ngrok config check failed: {(check.stderr or check.stdout).strip()}")
        print("[+] ngrok authtoken stored in the ignored local config (value hidden)")
    else:
        print("[!] NGROK_AUTHTOKEN is not configured; tunnel setup will remain blocked until it is set")


def _download_qwen_base() -> None:
    from aivala_preflight import find_local_hf_model

    existing = find_local_hf_model(QWEN_REPO, os.environ.get("QWEN_BASE_MODEL_PATH"))
    if existing:
        os.environ["QWEN_BASE_MODEL_PATH"] = str(existing)
        os.environ["HF_HUB_OFFLINE"] = "1"
        print(f"[+] Qwen base model cache ready: {existing}")
        return
    print(f"[*] Downloading Qwen base model snapshot to {QWEN_DIR} (large download)...")
    os.environ.pop("HF_HUB_OFFLINE", None)
    from huggingface_hub import snapshot_download

    snapshot_download(repo_id=QWEN_REPO, local_dir=str(QWEN_DIR))
    if not (QWEN_DIR / "config.json").is_file():
        raise RuntimeError("Qwen snapshot download completed without config.json")
    os.environ["QWEN_BASE_MODEL_PATH"] = str(QWEN_DIR)
    os.environ["HF_HUB_OFFLINE"] = "1"
    print(f"[+] Qwen base model prepared: {QWEN_DIR}")


def _install_dependencies() -> None:
    if not LOCK_FILE.is_file():
        raise RuntimeError(f"Missing canonical lock file: {LOCK_FILE}")
    python = _venv_python()
    subprocess.run([str(python), "-m", "pip", "install", "--upgrade", "pip", "setuptools==81.0.0"], check=True)
    subprocess.run([str(python), "-m", "pip", "install", "-r", str(LOCK_FILE)], check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-ffmpeg", action="store_true", help="Do not download the managed FFmpeg build")
    parser.add_argument("--skip-qwen-download", action="store_true", help="Do not download a missing Qwen base model")
    parser.add_argument("--skip-ngrok", action="store_true", help="Do not install the managed ngrok binary")
    args = parser.parse_args()
    _load_env_file()

    # Create the environment with the system interpreter, then re-enter through
    # it before importing setup dependencies. This avoids installing twice.
    if not _venv_python().is_file():
        print(f"[*] Creating virtual environment at {VENV_DIR}")
        subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
    if Path(sys.executable).resolve() != _venv_python().resolve():
        command = [str(_venv_python()), str(Path(__file__).resolve()), *sys.argv[1:]]
        return subprocess.run(command, check=False).returncode

    _install_dependencies()
    from aivala_preflight import run_preflight

    if not args.skip_ffmpeg:
        _download_ffmpeg()
    if not args.skip_ngrok:
        _install_ngrok()
    if not args.skip_qwen_download:
        _download_qwen_base()
    tunnel_requested = os.environ.get("AIVALA_ENABLE_TUNNEL", "0")
    # A persistent domain is account-specific and cannot be inferred safely by
    # setup. Validate the binary/token when available, but defer the domain
    # requirement to the launch preflight.
    os.environ["AIVALA_ENABLE_TUNNEL"] = "0"
    ok = run_preflight(strict=False, check_ports=False)
    os.environ["AIVALA_ENABLE_TUNNEL"] = tunnel_requested
    if tunnel_requested.strip().lower() in {"1", "true", "yes", "on"} and not os.environ.get("NGROK_DOMAIN", "").strip():
        print("[!] Setup complete, but NGROK_DOMAIN must be configured before tunnel-enabled launch")
    if not ok:
        print("[-] Setup finished with blocking preflight failures. Resolve them before launch.")
        return 1
    print("[+] AIVALA setup complete. Start with: .venv\\Scripts\\python.exe start_local_ai.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
