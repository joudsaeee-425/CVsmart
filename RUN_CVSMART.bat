@echo off
cd /d "%~dp0"
title CVSmart
echo CVSmart - Production-like local server
where python >nul 2>nul
if errorlevel 1 goto nopython
if not exist ".venv\Scripts\python.exe" (
 python -m venv .venv
 if errorlevel 1 goto fail
)
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto fail
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto fail
echo.
echo Open: http://127.0.0.1:5000
".venv\Scripts\python.exe" backend\app.py
if errorlevel 1 goto fail
exit /b 0
:nopython
echo Python was not found in PATH.
pause
exit /b 1
:fail
echo.
echo CVSmart could not start. Please screenshot the error above.
pause
exit /b 1
