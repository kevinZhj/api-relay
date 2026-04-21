@echo off

echo ==========================================
echo API Relay Server
echo ==========================================
echo.

if not exist .env (
  echo [ERROR] .env file not found
  echo Please copy .env.example to .env first
  echo.
  echo   copy .env.example .env
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [ERROR] node_modules not found
  echo Please run: npm install
  echo.
  pause
  exit /b 1
)

echo Starting server...
echo.

pnpm run start

if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Start failed
  pause
)
