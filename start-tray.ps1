Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# 检查 tsx
$tsxPath = Join-Path $scriptPath "node_modules\.bin\tsx.cmd"
if (-not (Test-Path $tsxPath)) {
    [System.Windows.Forms.MessageBox]::Show("未找到 tsx，请先运行 pnpm install", "错误", "OK", "Error")
    exit 1
}

# 检查是否已在运行
$existing = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "node.exe" -and ($_.CommandLine -like "*tsx*" -or $_.CommandLine -like "*index.ts*")
}
if ($existing) {
    [System.Windows.Forms.MessageBox]::Show("API中转站已经在运行中`n`nURL: http://localhost:3000`nAdmin: http://localhost:3000/admin/accounts", "提示", "OK", "Information")
    exit 0
}

# 创建隐藏窗口
$form = New-Object System.Windows.Forms.Form
$form.WindowState = "Minimized"
$form.ShowInTaskbar = $false
$form.Visible = $false

# 创建托盘图标
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.Text = "API中转站 - 启动中..."
$notify.Visible = $true

# 上下文菜单
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menu.Items.Add("打开管理面板", $null, {
    Start-Process "http://localhost:3000/admin/accounts"
}) | Out-Null
$menu.Items.Add("复制 API URL", $null, {
    Set-Clipboard "http://localhost:3000/v1"
    $notify.ShowBalloonTip(2000, "API中转站", "URL已复制到剪贴板", [System.Windows.Forms.ToolTipIcon]::Info)
}) | Out-Null
$menu.Items.Add("-") | Out-Null
$menu.Items.Add("停止服务", $null, {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq "node.exe" -and ($_.CommandLine -like "*tsx*" -or $_.CommandLine -like "*index.ts*")
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    $notify.Visible = $false
    [System.Windows.Forms.Application]::Exit()
}) | Out-Null
$notify.ContextMenuStrip = $menu

# 启动服务
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c `""$tsxPath`" src\index.ts"
$psi.WorkingDirectory = $scriptPath
$psi.WindowStyle = "Hidden"
$psi.CreateNoWindow = $true
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true

$process = [System.Diagnostics.Process]::Start($psi)

# 等待启动并检查状态
Start-Sleep -Seconds 2
$started = $false
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/admin/accounts" -Headers @{ "Authorization" = "Bearer admin123" } -TimeoutSec 3 -UseBasicParsing
    if ($resp.StatusCode -eq 200) { $started = $true }
} catch {}

if ($started) {
    $notify.Text = "API中转站 - 运行中`nhttp://localhost:3000"
    $notify.Icon = [System.Drawing.SystemIcons]::Shield
    $notify.ShowBalloonTip(3000, "API中转站", "服务已在后台启动`n点击托盘图标可打开管理面板或停止", [System.Windows.Forms.ToolTipIcon]::Info)
} else {
    $notify.Text = "API中转站 - 启动失败"
    $notify.Icon = [System.Drawing.SystemIcons]::Error
    $notify.ShowBalloonTip(3000, "API中转站", "服务启动失败，请检查配置", [System.Windows.Forms.ToolTipIcon]::Error)
}

# 运行消息循环
[System.Windows.Forms.Application]::Run($form)

# 退出时清理
$notify.Visible = $false
if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
}
