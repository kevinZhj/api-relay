' API中转站 - 设置开机自启
' 双击此文件将API中转站添加到Windows开机启动项

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)
startVbs = scriptPath & "\start.vbs"
startupFolder = WshShell.SpecialFolders("Startup")
shortcutPath = startupFolder & "\API中转站.lnk"

If Not fso.FileExists(startVbs) Then
    MsgBox "未找到 start.vbs，请确保此脚本位于项目根目录", vbExclamation, "错误"
    WScript.Quit
End If

' 创建快捷方式
Set shortcut = WshShell.CreateShortcut(shortcutPath)
shortcut.TargetPath = startVbs
shortcut.WorkingDirectory = scriptPath
shortcut.IconLocation = "%SystemRoot%\System32\shell32.dll, 14"
shortcut.Description = "API中转站 - 智能路由"
shortcut.Save

MsgBox "已添加到开机启动" & vbCrLf & vbCrLf & "快捷方式位置:" & vbCrLf & shortcutPath & vbCrLf & vbCrLf & "下次开机时API中转站将自动在后台启动" & vbCrLf & vbCrLf & "如需取消，请删除上述快捷方式", vbInformation, "API中转站"

Set WshShell = Nothing
Set fso = Nothing
