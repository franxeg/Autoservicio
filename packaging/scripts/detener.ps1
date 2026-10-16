# ---------------------------------------------------------------------------
#  Autoservicio - detener la aplicacion y PostgreSQL
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Log([string]$m) { Write-Host "[autoservicio] $m" -ForegroundColor Cyan }

# 1) Detener la aplicacion Node (dist/main.js)
$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*dist\main*' -or $_.CommandLine -like '*dist/main*' }
foreach ($p in $procs) { Log "Deteniendo aplicacion (PID $($p.ProcessId))..."; Stop-Process -Id $p.ProcessId -Force }

# 2) Detener PostgreSQL
$pgctl = Join-Path $root 'pgsql\bin\pg_ctl.exe'
$dataDir = Join-Path $root 'data'
if (Test-Path $pgctl) {
  Log "Deteniendo PostgreSQL..."
  & $pgctl -D $dataDir stop -m fast
}

Log "Listo."
