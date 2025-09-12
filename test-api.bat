@echo off
echo Running Susan AI API Test Suite...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if the API server is running
echo Checking if API server is running...
curl -s http://localhost:3001/api/v1/health >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: API server is not running
    echo Please start the API server first using start-api.bat
    echo.
    pause
    exit /b 1
)

echo API server is running. Starting tests...
echo.

REM Set test environment variables
set TEST_API_KEY=test-api-key-123
set NODE_ENV=test

REM Run the test suite
node src/api/test/api-test.js

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ All tests passed successfully!
) else (
    echo.
    echo ❌ Some tests failed. Check the output above for details.
)

echo.
pause