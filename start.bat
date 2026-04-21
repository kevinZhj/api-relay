@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install
)

echo.
echo Starting API Relay...
echo URL: http://localhost:3000
echo Admin: http://localhost:3000/admin/accounts
echo.

pnpm start

pause
