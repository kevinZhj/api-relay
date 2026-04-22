' API中转站 - 停止服务
' 双击此文件停止后台运行的API中转站

Set WMIService = GetObject("winmgmts://./root/cimv2")
Set WshShell = CreateObject("WScript.Shell")

' 查找并杀死API中转站相关的node进程
Set processes = WMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe' AND (CommandLine LIKE '%tsx%' OR CommandLine LIKE '%index.ts%')")

killed = 0
For Each proc In processes
    ' 确认是中转站目录下的进程
    If InStr(proc.CommandLine, "中转站") > 0 Or InStr(proc.CommandLine, "relay") > 0 Or InStr(proc.CommandLine, "index.ts") > 0 Then
        proc.Terminate
        killed = killed + 1
    End If
Next

If killed > 0 Then
    MsgBox "API中转站已停止" & vbCrLf & "共终止 " & killed & " 个相关进程", vbInformation, "API中转站"
Else
    MsgBox "未找到运行中的API中转站进程", vbExclamation, "API中转站"
End If

Set WMIService = Nothing
Set WshShell = Nothing
