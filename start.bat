@echo off
chcp 65001 >nul
cd /d "%~dp0"

title API中转站 - 启动器
cls

echo ========================================
echo       API 中转站 - 启动器
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [❌] 未找到 Node.js，请先安装 Node.js
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查 pnpm
where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [❌] 未找到 pnpm，正在尝试安装...
    call npm install -g pnpm
    if %ERRORLEVEL% neq 0 (
        echo [❌] pnpm 安装失败，请手动运行: npm install -g pnpm
        pause
        exit /b 1
    )
)

REM 检查 .env
if not exist ".env" (
    if exist ".env.example" (
        echo [⚠️] .env 不存在，正在从 .env.example 复制...
        copy /y ".env.example" ".env" >nul
        echo [✅] 已创建 .env
    ) else (
        echo [⚠️] 未找到 .env 文件
    )
)

REM 检查依赖
if not exist "node_modules" (
    echo [⏳] 正在安装依赖，请稍候...
    call pnpm install
    if %ERRORLEVEL% neq 0 (
        echo [❌] 依赖安装失败
        pause
        exit /b 1
    )
    echo [✅] 依赖安装完成
)

REM 检查端口占用
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo [⚠️] 端口 3000 已被占用（PID: %%a），正在尝试关闭...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo.
echo ========================================
echo [✅] 环境检查通过！
echo.
echo 请选择启动方式：
echo    [1] 前台启动 （显示日志，Ctrl+C 停止）
echo    [2] 后台启动 （隐藏窗口，双击 stop.vbs 停止）
echo    [3] 托盘启动 （系统托盘图标，右键菜单）
echo    [4] 停止服务
echo    [5] 打开管理面板
echo    [6] 设置开机自启
echo    [0] 退出
echo.

choice /c 1234560 /n /m "请输入选项 [1-6 或 0]: "

if %ERRORLEVEL% equ 1 goto :frontend
if %ERRORLEVEL% equ 2 goto :background
if %ERRORLEVEL% equ 3 goto :tray
if %ERRORLEVEL% equ 4 goto :stop
if %ERRORLEVEL% equ 5 goto :admin
if %ERRORLEVEL% equ 6 goto :autostart
if %ERRORLEVEL% equ 7 goto :exit

:frontend
echo.
echo [🚀] 正在前台启动服务...
echo    URL:     http://localhost:3000
echo    Admin:   http://localhost:3000/admin/accounts
echo    管理密钥: admin123
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.
pnpm start
if %ERRORLEVEL% neq 0 (
    echo.
    echo [❌] 服务异常退出，代码: %ERRORLEVEL%
    pause
)
goto :exit

:background
if exist "start.vbs" (
    echo [🚀] 正在后台启动...
    start "" "start.vbs"
    timeout /t 2 /nobreak >nul
    echo [✅] 服务已在后台启动
    echo    URL:   http://localhost:3000
    echo    Admin: http://localhost:3000/admin/accounts
) else (
    echo [❌] 未找到 start.vbs
)
pause
goto :exit

:tray
if exist "start-tray.ps1" (
    echo [🚀] 正在启动托盘版...
    powershell -ExecutionPolicy Bypass -File "start-tray.ps1"
) else (
    echo [❌] 未找到 start-tray.ps1
    pause
)
goto :exit

:stop
if exist "stop.vbs" (
    echo [🔴] 正在停止服务...
    start "" "stop.vbs"
) else (
    echo [⏳] 正在停止 node 进程...
    taskkill /f /im node.exe >nul 2>&1
    echo [✅] 已停止
    pause
)
goto :exit

:admin
echo [🌐] 正在打开管理面板...
start http://localhost:3000/admin/accounts
goto :exit

:autostart
if exist "setup-autostart.vbs" (
    echo [⚙️] 正在设置开机自启...
    start "" "setup-autostart.vbs"
) else (
    echo [❌] 未找到 setup-autostart.vbs
    pause
)
goto :exit

:exit
echo.
echo 按任意键退出...
pause >nul
