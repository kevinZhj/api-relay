' API中转站 - 隐藏窗口启动
' 双击此文件即可在后台启动服务（不显示黑窗口）

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取脚本所在目录
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' 检查是否已经在运行
Set WMIService = GetObject("winmgmts://./root/cimv2")
Set processes = WMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe' AND CommandLine LIKE '%tsx%' AND CommandLine LIKE '%中转站%'")

If processes.Count > 0 Then
    MsgBox "API中转站已经在运行中" & vbCrLf & vbCrLf & "URL: http://localhost:3000" & vbCrLf & "Admin: http://localhost:3000/admin/accounts", vbInformation, "API中转站"
    WScript.Quit
End If

' 检查 node 是否安装
nodePath = """" & scriptPath & "\node_modules\.bin\tsx.cmd"""
If Not fso.FileExists(scriptPath & "\node_modules\.bin\tsx.cmd") Then
    MsgBox "未找到 tsx，请先运行 pnpm install 安装依赖" & vbCrLf & vbCrLf & "命令: pnpm install", vbExclamation, "API中转站 - 错误"
    WScript.Quit
End If

' 启动服务（隐藏窗口）
WshShell.CurrentDirectory = scriptPath
Set exec = WshShell.Exec("cmd /c """"" & nodePath & """ src\index.ts"" 2>nul")

' 等待服务启动
WScript.Sleep 2000

' 检查是否启动成功
Set http = CreateObject("Microsoft.XMLHTTP")
On Error Resume Next
http.open "GET", "http://localhost:3000/admin/accounts", False
http.setRequestHeader "Authorization", "Bearer admin123"
http.send
On Error GoTo 0

If http.status = 200 Then
    MsgBox "API中转站已在后台启动" & vbCrLf & vbCrLf & "URL: http://localhost:3000" & vbCrLf & "Admin: http://localhost:3000/admin/accounts" & vbCrLf & vbCrLf & "服务已在后台运行，关闭此窗口不影响服务", vbInformation, "API中转站"
Else
    MsgBox "服务启动失败，请检查配置或手动运行 start.bat 查看错误", vbExclamation, "API中转站 - 错误"
End If

Set WshShell = Nothing
Set fso = Nothing
Set http = Nothing
