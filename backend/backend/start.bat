@echo off
setlocal
set "ROOT=%~dp0..\.."
set "PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
  echo [ERROR] %ROOT%\.venv is missing. Run: python setup_local_ai.py
  exit /b 1
)
set "PORT=%AIVALA_SECURITY_PORT%"
if "%PORT%"=="" set "PORT=8010"
echo Starting AIVALA Security Backend on http://127.0.0.1:%PORT% ...
"%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port %PORT%
pause
