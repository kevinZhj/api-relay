@echo off
cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm not found. Installing...
    call npm install -g pnpm
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] pnpm install failed
        pause
        exit /b 1
    )
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call pnpm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] pnpm install failed
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo       API Relay - Smart Router
echo ========================================
echo.
echo Service: http://localhost:3000
echo Admin:   http://localhost:3000/admin/accounts
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

pnpm start
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Server exited with code %ERRORLEVEL%
    pause
)
