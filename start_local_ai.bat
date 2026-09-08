@echo off
setlocal
title AIVALA Local GPU AI Infrastructure Launcher
echo =========================================================
echo  Starting AIVALA Local GPU AI Server ^& ngrok Mobile Tunnel
echo =========================================================
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] .venv is missing. Run: python setup_local_ai.py
    set "EXIT_CODE=1"
    goto :failed
)

".venv\Scripts\python.exe" "start_local_ai.py"
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="0" exit /b 0

:failed
echo.
echo [ERROR] AIVALA startup stopped with exit code %EXIT_CODE%.
echo Review the messages above, then run setup_local_ai.py if a dependency is missing.
pause
exit /b %EXIT_CODE%
