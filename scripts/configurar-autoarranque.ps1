$ErrorActionPreference = 'Stop'
$iniciar = Join-Path $PSScriptRoot 'iniciar-servicio.ps1'
$argumentos = "-NoProfile -ExecutionPolicy Bypass -File `"$iniciar`""
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentos
$disparador = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'AutoservicioServidor' -Action $accion -Trigger $disparador -Settings $settings -RunLevel Highest -Force | Out-Null
Write-Host "Autoarranque configurado al iniciar sesión de $env:USERNAME"