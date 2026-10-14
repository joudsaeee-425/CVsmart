@echo off
cd /d "%~dp0"
if exist .venv rmdir /s /q .venv
echo Environment reset complete.
pause
