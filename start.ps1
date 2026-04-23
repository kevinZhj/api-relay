$Host.UI.RawUI.WindowTitle = "API Relay"
Set-Location $PSScriptRoot

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] pnpm not found. Install it first:" -ForegroundColor Red
    Write-Host "  npm install -g pnpm" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-Host "[WARN] .env not found, copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Cyan
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] pnpm install failed" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "     API Relay - Smart Router     " -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Service: http://localhost:8088" -ForegroundColor Cyan
Write-Host "Admin:   http://localhost:8088/admin/accounts" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

pnpm start
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Server exited with code $LASTEXITCODE" -ForegroundColor Red
    Read-Host "Press Enter to exit"
}
