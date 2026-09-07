"""Launch the complete AIVALA local GPU stack and its optional ngrok tunnel."""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def load_local_environment(path: Path) -> None:
    """Load private local settings without overriding parent-process settings."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


ROOT_DIR = Path(__file__).resolve().parent
load_local_environment(ROOT_DIR / ".env.local")

from aivala_preflight import (  # noqa: E402
    MANAGED_NGROK_PATH,
    configure_media_path,
    resolve_executable,
    run_preflight,
)


SEVERITY_SCRIPT = ROOT_DIR / "severity_api.py"
INFERENCE_SCRIPT = ROOT_DIR / "Huggingface Space files" / "ai_inference_server.py"
QLORA_ADAPTER_DIR = ROOT_DIR / "models" / "qwen3-vl-4b-car-damage-lora"
SECURITY_BACKEND_DIR = ROOT_DIR / "backend" / "backend"
YOLO_CONFIG_DIR = SECURITY_BACKEND_DIR / "data" / "ultralytics"
SEVERITY_PORT = 7860
INFERENCE_PORT = 8001
SECURITY_PORT = 8000


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def wait_for_health(url: str, name: str, process: subprocess.Popen, timeout: int) -> bool:
    print(f"[*] Waiting for {name} to initialize...", end="", flush=True)
    start = time.time()
    while time.time() - start < timeout:
        if process.poll() is not None:
            print(f"\n[-] {name} exited before becoming healthy (code {process.returncode}).")
            return False
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    print(f"\n[+] {name} is ONLINE at {url}")
                    return True
        except Exception:
            print(".", end="", flush=True)
            time.sleep(2)
    print(f"\n[-] Timed out waiting for {name}.")
    return False


def cleanup_stale_tunnels() -> None:
    """Stop only the ngrok binary managed/configured for this AIVALA install."""
    ngrok_path = resolve_executable("ngrok.exe" if os.name == "nt" else "ngrok", "NGROK_PATH", MANAGED_NGROK_PATH)
    if not ngrok_path:
        return
    try:
        from pyngrok import conf, ngrok

        config = conf.PyngrokConfig(ngrok_path=str(ngrok_path))
        ngrok.kill(pyngrok_config=config)
    except Exception:
        # A manually started process is not owned by this Python process and is
        # deliberately not killed blindly by name.
        pass


def start_ngrok_tunnel(port: int) -> str:
    """Open and validate the configured persistent ngrok dev domain.

    There is intentionally no SSH fallback: the public endpoint must be
    authenticated and tied to the configured ngrok domain.
    """
    from pyngrok import conf, ngrok

    ngrok_path = resolve_executable("ngrok.exe" if os.name == "nt" else "ngrok", "NGROK_PATH", MANAGED_NGROK_PATH)
    token = os.environ.get("NGROK_AUTHTOKEN", "").strip()
    domain = os.environ.get("NGROK_DOMAIN", "").strip()
    if not ngrok_path:
        raise RuntimeError("ngrok.exe is unavailable; run setup_local_ai.py")
    if len(token) < 16:
        raise RuntimeError("NGROK_AUTHTOKEN is missing or too short")
    if not domain:
        raise RuntimeError("NGROK_DOMAIN must name the persistent dev domain")

    cleanup_stale_tunnels()
    config = conf.PyngrokConfig(
        ngrok_path=str(ngrok_path),
        auth_token=token,
        region=os.environ.get("NGROK_REGION", "ap").strip().lower(),
        config_path=str(ngrok_path.parent / "ngrok.yml"),
        startup_timeout=30,
    )
    tunnel = ngrok.connect(port, "http", domain=domain, pyngrok_config=config)
    url = str(tunnel.public_url).replace("http://", "https://", 1)
    if domain.lower() not in url.lower():
        ngrok.kill(pyngrok_config=config)
        raise RuntimeError(f"ngrok returned an unexpected endpoint instead of {domain}: {url}")
    print(f"\n[+] ngrok persistent dev domain validated: {url}")
    return url


def stop_processes(processes: list[subprocess.Popen]) -> None:
    for process in reversed(processes):
        if process.poll() is not None:
            continue
        try:
            process.terminate()
            process.wait(timeout=5)
        except Exception:
            try:
                process.kill()
                process.wait(timeout=3)
            except Exception:
                pass
    cleanup_stale_tunnels()


def main() -> int:
    print("=" * 72)
    print("  AIVALA Local GPU AI Server & Mobile Remote Tunnel")
    print("=" * 72)
    configure_media_path()
    processes: list[subprocess.Popen] = []

    try:
        if not run_preflight(strict=True):
            print("[-] Startup aborted. Run `python setup_local_ai.py` or resolve the listed checks.")
            return 1

        qwen_env = os.environ.copy()
        qwen_env["QWEN_ADAPTER_PATH"] = qwen_env.get("QWEN_ADAPTER_PATH", str(QLORA_ADAPTER_DIR))
        qwen_env.setdefault("QWEN_LOAD_IN_4BIT", "1")
        print(f"\n[1/4] Launching Qwen Vision Severity API (port {SEVERITY_PORT})...")
        qwen = subprocess.Popen([sys.executable, str(SEVERITY_SCRIPT)], env=qwen_env)
        processes.append(qwen)
        if not wait_for_health(f"http://127.0.0.1:{SEVERITY_PORT}/health", "Qwen Severity API", qwen, 360):
            raise RuntimeError("Qwen Severity API failed its health check")

        yolo_env = os.environ.copy()
        yolo_env["VLM_SEVERITY_URL"] = f"http://127.0.0.1:{SEVERITY_PORT}/severity"
        yolo_env["AI_SERVER_PORT"] = str(INFERENCE_PORT)
        YOLO_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        yolo_env["YOLO_CONFIG_DIR"] = str(YOLO_CONFIG_DIR)
        print(f"\n[2/4] Launching YOLO Damage Inference API (port {INFERENCE_PORT})...")
        yolo = subprocess.Popen([sys.executable, str(INFERENCE_SCRIPT)], env=yolo_env)
        processes.append(yolo)
        if not wait_for_health(f"http://127.0.0.1:{INFERENCE_PORT}/health", "YOLO Inference API", yolo, 90):
            raise RuntimeError("YOLO Inference API failed its health check")

        gateway_env = os.environ.copy()
        gateway_env["AI_INFERENCE_SERVER_URL"] = f"http://127.0.0.1:{INFERENCE_PORT}/analyze-video"
        print(f"\n[3/4] Launching Evidence Verification Gateway (port {SECURITY_PORT})...")
        gateway = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(SECURITY_PORT)],
            cwd=str(SECURITY_BACKEND_DIR),
            env=gateway_env,
        )
        processes.append(gateway)
        if not wait_for_health(f"http://127.0.0.1:{SECURITY_PORT}/health", "Evidence Verification Gateway", gateway, 90):
            raise RuntimeError("Evidence Verification Gateway failed its health check")

        enable_tunnel = _truthy(os.environ.get("AIVALA_ENABLE_TUNNEL")) and not _truthy(os.environ.get("AIVALA_SKIP_TUNNEL"))
        public_url = None
        if enable_tunnel:
            print(f"\n[4/4] Opening validated ngrok tunnel for mobile access...")
            public_url = start_ngrok_tunnel(SECURITY_PORT)
        else:
            print("\n[4/4] Tunnel disabled. Set AIVALA_ENABLE_TUNNEL=1 to enable it.")

        print("\n" + "=" * 72)
        print("  LOCAL AI INFRASTRUCTURE IS RUNNING")
        print("=" * 72)
        print(f"  Local Gateway URL : http://localhost:{SECURITY_PORT}")
        print(f"  Internal YOLO URL : http://localhost:{INFERENCE_PORT}")
        if public_url:
            print(f"  MOBILE APP URL    : {public_url}")
        print("=" * 72)
        print("Press CTRL+C to stop all services.\n")

        while True:
            for service_name, process in (("Qwen", qwen), ("YOLO", yolo), ("Gateway", gateway)):
                if process.poll() is not None:
                    raise RuntimeError(f"{service_name} service exited unexpectedly (code {process.returncode})")
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Shutdown requested.")
        return 0
    except Exception as exc:
        print(f"\n[-] Startup failed: {exc}")
        return 1
    finally:
        stop_processes(processes)
        print("[+] All AIVALA services stopped cleanly.")


if __name__ == "__main__":
    raise SystemExit(main())
