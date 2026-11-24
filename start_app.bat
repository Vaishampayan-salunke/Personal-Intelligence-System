@echo off
title Know Thyself AI - Launcher
echo ===================================================
echo     KNOW THYSELF AI - Full Stack Platform
echo ===================================================
echo.
echo Starting Backend (FastAPI on http://127.0.0.1:8000)...
start "Know Thyself AI - Backend" cmd /k "cd /d "%~dp0know-thyself-ai\backend" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Frontend (Vite on http://localhost:5173)...
start "Know Thyself AI - Frontend" cmd /k "cd /d "%~dp0know-thyself-ai\frontend" && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ===================================================
echo Know Thyself AI is running!
echo Frontend: http://localhost:5173
echo Backend API docs: http://127.0.0.1:8000/docs
echo ===================================================
pause
