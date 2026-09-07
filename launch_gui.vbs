Set WshShell = CreateObject("WScript.Shell")
Set FileSystem = CreateObject("Scripting.FileSystemObject")

AppFolder = FileSystem.GetParentFolderName(WScript.ScriptFullName)
BatchLauncher = AppFolder & "\start_local_ai.bat"

WshShell.CurrentDirectory = AppFolder
WshShell.Run Chr(34) & BatchLauncher & Chr(34), 1, False
