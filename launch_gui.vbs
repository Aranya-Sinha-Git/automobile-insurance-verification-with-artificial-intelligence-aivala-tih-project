Set WshShell = CreateObject("WScript.Shell")
Set FileSystem = CreateObject("Scripting.FileSystemObject")

AppFolder = FileSystem.GetParentFolderName(WScript.ScriptFullName)
BatchLauncher = AppFolder & "\start_local_ai.bat"

If Not FileSystem.FileExists(BatchLauncher) Then
    MsgBox "AIVALA launcher is missing:" & vbCrLf & BatchLauncher, vbCritical, "AIVALA launcher"
    WScript.Quit 1
End If

WshShell.CurrentDirectory = AppFolder
WshShell.Run "cmd.exe /d /c call " & Chr(34) & BatchLauncher & Chr(34), 1, False
WScript.Quit 0
