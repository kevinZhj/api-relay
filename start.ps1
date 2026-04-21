$Host.UI.RawUI.WindowTitle = "API Relay"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    Write-Host "[WARN] .env not found, copying from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Cyan
    pnpm install
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "     API Relay - Smart Router     " -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Service: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Admin:   http://localhost:3000/admin/accounts" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

pnpm start
