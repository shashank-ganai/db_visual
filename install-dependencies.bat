@echo off
title DB Visualizer - Install Dependencies
cd /d "%~dp0server"

echo ========================================================
echo Installing Production Node.js Dependencies for Server
echo ========================================================
call npm install --omit=dev

echo.
echo ========================================================
echo [SUCCESS] Dependencies installed successfully.
echo You can now run start-server.bat or use PM2 / NSSM.
echo ========================================================
pause
