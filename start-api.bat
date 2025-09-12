@echo off
echo Starting Susan AI Comprehensive API Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist package.json (
    echo ERROR: package.json not found
    echo Please run this script from the susan-ai directory
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found
    echo Creating .env file from .env.example...
    if exist .env.example (
        copy .env.example .env
        echo Please edit .env file with your API keys before starting the server
    ) else (
        echo Creating basic .env file...
        echo # Susan AI Configuration > .env
        echo NODE_ENV=development >> .env
        echo PORT=3001 >> .env
        echo HOST=localhost >> .env
        echo JWT_SECRET=your-secret-key-change-this-in-production >> .env
        echo LOG_LEVEL=info >> .env
        echo # >> .env
        echo # AI Provider API Keys >> .env
        echo OPENAI_API_KEY=your-openai-api-key >> .env
        echo ANTHROPIC_API_KEY=your-anthropic-api-key >> .env
        echo # >> .env
        echo # API Configuration >> .env
        echo CORS_ORIGIN=http://localhost:3000,http://localhost:3001 >> .env
        echo VALID_API_KEYS=test-api-key-123,api-key-456 >> .env
        echo ADMIN_API_KEYS=admin-key-789 >> .env
    )
    echo.
    echo IMPORTANT: Please edit the .env file with your actual API keys!
    echo.
)

echo Starting Susan AI Comprehensive API Server...
echo.
echo Available endpoints:
echo   • API Documentation: http://localhost:3001/docs
echo   • OpenAPI Spec: http://localhost:3001/api/v1/openapi.yaml
echo   • Health Check: http://localhost:3001/api/v1/health
echo   • Conversations: http://localhost:3001/api/v1/conversations
echo   • Voice Processing: http://localhost:3001/api/v1/voice
echo   • AI Models: http://localhost:3001/api/v1/models
echo   • Memory Search: http://localhost:3001/api/v1/memory
echo   • Plugin System: http://localhost:3001/api/v1/plugins
echo   • File Processing: http://localhost:3001/api/v1/files
echo   • Real-time Data: http://localhost:3001/api/v1/data
echo   • User Management: http://localhost:3001/api/v1/users
echo   • Authentication: http://localhost:3001/api/v1/auth
echo   • Administration: http://localhost:3001/api/v1/admin
echo.
echo Press Ctrl+C to stop the server
echo.

npm run start:api