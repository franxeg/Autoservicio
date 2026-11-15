Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strDir = fso.GetParentFolderName(WScript.ScriptFullName)
strScript = strDir & "\scripts\iniciar.ps1"

' Argumentos opcionales (por ejemplo -NoBrowser), se pasan tal cual a iniciar.ps1
extra = ""
For Each a In WScript.Arguments
  extra = extra & " " & a
Next

' Ejecuta el inicio sin mostrar la consola. -Progress abre una ventana con
' la barra de avance mientras carga PostgreSQL y la aplicacion.
WshShell.Run "powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strScript & """ -Progress" & extra, 0, False

Set WshShell = Nothing
Set fso = Nothing
