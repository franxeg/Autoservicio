Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strDir = fso.GetParentFolderName(WScript.ScriptFullName)
strScript = strDir & "\scripts\iniciar.ps1"

' Ejecuta el script de inicio oculto (sin mostrar consola)
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strScript & """", 0, False

Set WshShell = Nothing
Set fso = Nothing
