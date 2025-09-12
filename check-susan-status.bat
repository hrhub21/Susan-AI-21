@echo off
title Susan AI - Status Check
color 0A

echo ================================
echo     SUSAN AI - STATUS CHECK
echo ================================
echo.

REM Check if Susan AI is running on port 3001
echo 🔍 Checking if Susan AI is running...
netstat -ano | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo ✅ Susan AI is RUNNING on port 3001
    echo.
    
    REM Test the health endpoint
    echo 🏥 Testing health endpoint...
    curl -s http://localhost:3001/health >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Susan AI is responding to requests
        echo.
        echo 🌐 Access Susan at: http://localhost:3001
        echo 💡 Your AI assistant is ready to use!
    ) else (
        echo ❌ Susan AI port is occupied but not responding properly
        echo 🔧 Try restarting the server
    )
) else (
    echo ❌ Susan AI is NOT running
    echo 🚀 Use start-full-ai.bat to start Susan AI
)

echo.
echo Press any key to exit...
pause > nul