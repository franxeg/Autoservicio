param(
  [int]$RetenerDias = 14
)

# ---------------------------------------------------------------------------
#  Autoservicio - backup de la base de datos (pg_dump, formato custom)
#  Conserva los ultimos $RetenerDias backups y borra los mas viejos.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Log([string]$m) { Write-Host "[autoservicio] $m" -ForegroundColor Cyan }

$pgBin      = Join-Path $root 'pgsql\bin'
$backupsDir = Join-Path $root 'backups'
$configPath = Join-Path $root 'config.env'

if (!(Test-Path $backupsDir)) { New-Item -ItemType Directory -Path $backupsDir | Out-Null }

$cfg = @{}
Get-Content $configPath | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } | ForEach-Object {
  $i = $_.IndexOf('='); if ($i -gt 0) { $cfg[$_.Substring(0,$i).Trim()] = $_.Substring($i+1).Trim() }
}

$env:PGPASSWORD = $cfg.POSTGRES_PASSWORD
$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $backupsDir "autoservicio-$stamp.dump"

Log "Generando backup $outFile ..."
& (Join-Path $pgBin 'pg_dump.exe') -h 127.0.0.1 -p $cfg.PGPORT -U $cfg.POSTGRES_USER -d $cfg.POSTGRES_DB -F c -f $outFile
if ($LASTEXITCODE -ne 0) { throw "Fallo pg_dump" }

# Rotacion: borrar los mas viejos que RetenerDias
$limite = (Get-Date).AddDays(-$RetenerDias)
Get-ChildItem $backupsDir -Filter 'autoservicio-*.dump' |
  Where-Object { $_.LastWriteTime -lt $limite } |
  ForEach-Object { Log "Borrando backup viejo $($_.Name)"; Remove-Item $_.FullName -Force }

Log "Backup listo."
