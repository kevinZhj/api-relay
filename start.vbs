' API��תվ - ���ش�������
' ˫�����ļ������ں�̨�������񣨲���ʾ�ڴ��ڣ�

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' ��ȡ�ű�����Ŀ¼
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' ����Ƿ��Ѿ�������
Set WMIService = GetObject("winmgmts://./root/cimv2")
Set processes = WMIService.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe' AND CommandLine LIKE '%tsx%' AND CommandLine LIKE '%��תվ%'")

If processes.Count > 0 Then
    MsgBox "API��תվ�Ѿ���������" & vbCrLf & vbCrLf & "URL: http://localhost:8088" & vbCrLf & "Admin: http://localhost:8088/admin/accounts", vbInformation, "API��תվ"
    WScript.Quit
End If

' ��� node �Ƿ�װ
nodePath = """" & scriptPath & "\node_modules\.bin\tsx.cmd"""
If Not fso.FileExists(scriptPath & "\node_modules\.bin\tsx.cmd") Then
    MsgBox "δ�ҵ� tsx���������� pnpm install ��װ����" & vbCrLf & vbCrLf & "����: pnpm install", vbExclamation, "API��תվ - ����"
    WScript.Quit
End If

' �����������ش��ڣ�
WshShell.CurrentDirectory = scriptPath
Set exec = WshShell.Exec("cmd /c """"" & nodePath & """ src\index.ts"" 2>nul")

' �ȴ���������
WScript.Sleep 2000

' ����Ƿ������ɹ�
Set http = CreateObject("Microsoft.XMLHTTP")
On Error Resume Next
http.open "GET", "http://localhost:8088/admin/accounts", False
http.setRequestHeader "Authorization", "Bearer %ADMIN_KEY%"
http.send
On Error GoTo 0

If http.status = 200 Then
    MsgBox "API��תվ���ں�̨����" & vbCrLf & vbCrLf & "URL: http://localhost:8088" & vbCrLf & "Admin: http://localhost:8088/admin/accounts" & vbCrLf & vbCrLf & "�������ں�̨���У��رմ˴��ڲ�Ӱ�����", vbInformation, "API��תվ"
Else
    MsgBox "��������ʧ�ܣ��������û��ֶ����� start.bat �鿴����", vbExclamation, "API��תվ - ����"
End If

Set WshShell = Nothing
Set fso = Nothing
Set http = Nothing
