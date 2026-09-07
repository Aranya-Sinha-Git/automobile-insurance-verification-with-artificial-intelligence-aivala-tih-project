@echo off
title AIVALA Local GPU AI Infrastructure Launcher
echo =========================================================
echo  Starting AIVALA Local GPU AI Server & ngrok Mobile Tunnel
echo =========================================================
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" "start_local_ai.py"
) else (
    echo [ERROR] .venv is missing. Run: python setup_local_ai.py
    exit /b 1
)
