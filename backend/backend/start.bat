@echo off
setlocal
set "ROOT=%~dp0..\.."
set "PYTHON=%ROOT%\.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
  echo [ERROR] %ROOT%\.venv is missing. Run: python setup_local_ai.py
  exit /b 1
)
echo Starting AIVALA Security Backend on http://127.0.0.1:8000 ...
"%PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
