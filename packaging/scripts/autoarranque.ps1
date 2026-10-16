param(
  [switch]$Quitar
)

# ---------------------------------------------------------------------------
#  Autoservicio - autoarranque en un unico equipo
#  Registra dos Tareas Programadas:
#    - "Autoservicio - Iniciar"        : arranca la app al iniciar sesion
#    - "Autoservicio - Backup diario"  : backup todos los dias a las 22:00
#  Uso:  autoarranque.bat            (instalar)
#        autoarranque.bat -Quitar    (desinstalar)
#  Ejecutar como Administrador (clic derecho > Ejecutar como administrador).
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$iniciar    = Join-Path $root 'scripts\iniciar.ps1'
$backup     = Join-Path $root 'scripts\backup.ps1'
$taskInicio = 'Autoservicio - Iniciar'
$taskBackup = 'Autoservicio - Backup diario'

function Log([string]$m) { Write-Host "[autoservicio] $m" -ForegroundColor Cyan }

foreach ($t in @($taskInicio, $taskBackup)) {
  if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $t -Confirm:$false
    Log "Tarea '$t' eliminada."
  }
}

if ($Quitar) { Log "Autoarranque desinstalado."; return }

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)

# 1) Arranque al iniciar sesion
$argInicio = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$iniciar`" -NoBrowser -NoPause"
Register-ScheduledTask -TaskName $taskInicio `
  -Action   (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argInicio) `
  -Trigger  (New-ScheduledTaskTrigger -AtLogOn) `
  -Settings $settings `
  -Description 'Inicia Autoservicio al iniciar sesion' -Force | Out-Null
Log "Tarea de inicio registrada."

# 2) Backup diario 22:00
$argBackup = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backup`""
Register-ScheduledTask -TaskName $taskBackup `
  -Action   (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argBackup) `
  -Trigger  (New-ScheduledTaskTrigger -Daily -At 22:00) `
  -Settings $settings `
  -Description 'Backup diario de la base de Autoservicio' -Force | Out-Null
Log "Tarea de backup diario registrada (22:00)."

Log "Listo. El sistema arranca solo al iniciar sesion y hace backup diario."
