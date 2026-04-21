@echo off
chcp 65001 >nul
cd /d "%~dp0"

where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm not found. Please install pnpm first:
    echo   npm install -g pnpm
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] pnpm install failed
        pause
        exit /b 1
    )
)

echo.
echo Starting API Relay...
echo URL: http://localhost:3000
echo Admin: http://localhost:3000/admin/accounts
echo.

pnpm start
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Server exited with code %ERRORLEVEL%
    pause
)
