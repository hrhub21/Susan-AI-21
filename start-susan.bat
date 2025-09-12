@echo off
echo Starting Susan AI Assistant...
echo.

REM Check if .env file exists
if not exist .env (
    echo ⚠️  Warning: .env file not found!
    echo Please copy .env.example to .env and add your API keys.
    echo.
    echo Would you like me to create a .env file for you? (Y/N)
    set /p create_env=
    if /i "%create_env%"=="Y" (
        copy .env.example .env
        echo ✅ Created .env file. Please edit it with your API keys.
        echo Press any key to continue...
        pause > nul
    )
)

echo 🤖 Starting Susan...
npm start