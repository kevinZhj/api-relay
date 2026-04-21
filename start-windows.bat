@echo off
chcp 65001 >nul
title API中转站

cd /d "%~dp0"

echo ==========================================
echo      API中转站 - 智能路由服务
echo ==========================================
echo.

REM 检查 .env
if not exist ".env" (
    echo [警告] 未找到 .env 文件，正在从 .env.example 复制...
    copy ".env.example" ".env" >nul
    echo [提示] 请修改 .env 中的 ADMIN_KEY 和其他配置
    echo.
)

REM 检查 node_modules
if not exist "node_modules" (
    echo [信息] 未找到 node_modules，正在安装依赖...
    call pnpm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败，请确保已安装 pnpm
        pause
        exit /b 1
    )
    echo.
)

echo [4;36m正在启动 API 中转站...[0m
echo.
echo 服务地址: http://localhost:3000
echo 管理面板: http://localhost:3000/admin/accounts
echo.
echo 按 Ctrl+C 停止服务
echo ==========================================
echo.

pnpm start

pause
