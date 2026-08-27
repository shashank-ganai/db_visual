@echo off
title DB Visualizer Production Server
cd /d "%~dp0server"

if not exist "node_modules" (
    echo [INFO] First time setup: Installing server dependencies...
    call npm install --omit=dev
)

if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy ".env.example" ".env"
    )
)

echo [INFO] Starting DB Visualizer Backend on port 3001...
node index.js
pause
