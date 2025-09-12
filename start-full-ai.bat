@echo off
title Susan AI - Full AI-Powered Version
color 0A

echo ================================
echo     SUSAN AI - FULL VERSION
echo ================================
echo.

REM Check if .env file exists
if not exist .env (
    echo ❌ ERROR: .env file not found!
    echo Please make sure you have a .env file with your API keys.
    echo.
    echo Press any key to exit...
    pause > nul
    exit /b 1
)

echo 🔍 Checking configuration...

REM Check if dependencies are installed
if not exist node_modules (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo 🤖 Starting Susan AI with FULL AI capabilities...
echo 📡 This version includes:
echo    • Real AI responses (OpenAI/Anthropic)
echo    • Speech recognition and synthesis
echo    • Conversation memory
echo    • Command processing
echo    • Advanced dialogue capabilities
echo.
echo 🌐 Server will start on: http://localhost:3001
echo 💡 Open this URL in your browser to interact with Susan
echo.
REM Check if server is already running
echo 🔍 Checking if Susan AI is already running on port 3001...
netstat -ano | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo 🎉 Susan AI is already running!
    echo 🌐 Access Susan at: http://localhost:3001
    echo 💡 Open this URL in your browser to interact with Susan
    echo.
    echo Press any key to continue...
    pause > nul
    exit /b 0
)

echo ⚡ Starting server...
echo.

node src/server.js

echo.
echo 👋 Susan AI server stopped.
pause