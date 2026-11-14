param(
  [string]$Backup,
  [switch]$Yes,
  [switch]$NoStart
)

# ---------------------------------------------------------------------------
#  Autoservicio - restaurar un backup (.dump o .sql) sobre esta instalacion.
#
#  Uso normal: doble clic en restaurar.bat (pide la ruta del backup).
#  Tambien se puede arrastrar el archivo .dump sobre restaurar.bat.
#
#  Que hace:
#   1) Pide/valida la ruta del backup.
#   2) Prepara la base local (primer arranque, PostgreSQL, base de datos).
#   3) Guarda un backup de seguridad de los datos actuales (si hay).
#   4) Reemplaza el contenido de la base con el backup indicado.
#   5) Arranca el sistema con los datos restaurados.
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Log([string]$m)  { Write-Host "[autoservicio] $m" -ForegroundColor Cyan }
function Warn([string]$m) { Write-Host "[autoservicio] $m" -ForegroundColor Yellow }
function Fail([string]$m) {
  Write-Host "[autoservicio] $m" -ForegroundColor Red
  if (-not $Yes) { Read-Host "Enter para cerrar" }
  exit 1
}

# Ejecuta una herramienta de PostgreSQL capturando stdout/stderr sin que
# PowerShell las trate como errores fatales.
function Invoke-Tool {
  param(
    [string]$Exe,
    [string[]]$Arguments,
    [string]$LogFile,
    [switch]$Quiet,
    [switch]$Capture
  )
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $lines = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
    $script:ToolExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  if ($LogFile) { $lines | Set-Content -Path $LogFile -Encoding ASCII }
  if ($Capture) { return (($lines | Out-String).Trim()) }
  if (!$Quiet -and $lines) { $lines | ForEach-Object { Write-Host $_ } }
  return $script:ToolExit
}

$node       = Join-Path $root 'node\node.exe'
$pgBin      = Join-Path $root 'pgsql\bin'
$dataDir    = Join-Path $root 'data'
$logsDir    = Join-Path $root 'logs'
$configPath = Join-Path $root 'config.env'
$backupsDir = Join-Path $root 'backups'

if (!(Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }
if (!(Test-Path $pgBin))   { Fail "No se encontro pgsql\bin. Bundle incompleto." }

$pgRestore = Join-Path $pgBin 'pg_restore.exe'
$pgDump    = Join-Path $pgBin 'pg_dump.exe'
$pgCtl     = Join-Path $pgBin 'pg_ctl.exe'
$pgReady   = Join-Path $pgBin 'pg_isready.exe'
$psql      = Join-Path $pgBin 'psql.exe'
$createdb  = Join-Path $pgBin 'createdb.exe'

# --- 1) ruta del backup ----------------------------------------------------
if ([string]::IsNullOrWhiteSpace($Backup)) {
  Write-Host ""
  Write-Host "Restauracion de un backup de Autoservicio" -ForegroundColor Cyan
  Write-Host "Arrastra el archivo .dump a esta ventana o pega la ruta completa."
  Write-Host ""
  $Backup = Read-Host "Ruta del backup"
}

$Backup = $Backup.Trim().Trim('"').Trim("'").Trim()
if ([string]::IsNullOrWhiteSpace($Backup)) { Fail "No se indico ninguna ruta." }
if (!(Test-Path -LiteralPath $Backup))     { Fail "No existe el archivo: $Backup" }
$Backup = (Resolve-Path -LiteralPath $Backup).Path
$info = Get-Item -LiteralPath $Backup
if ($info.PSIsContainer) { Fail "La ruta indicada es una carpeta, no un archivo." }

# Detectar formato: pg_dump custom (magic "PGDMP") o SQL plano.
$magic = ''
$fs = [System.IO.File]::OpenRead($Backup)
try {
  $buf = New-Object byte[] 5
  $read = $fs.Read($buf, 0, 5)
  if ($read -eq 5) { $magic = [System.Text.Encoding]::ASCII.GetString($buf) }
} finally { $fs.Close() }
$esCustom = ($magic -eq 'PGDMP')

Write-Host ""
Write-Host "Backup:       $Backup" -ForegroundColor Cyan
Write-Host "Formato:      $(if ($esCustom) { 'pg_dump (custom)' } else { 'SQL plano' })" -ForegroundColor Cyan
Write-Host "Tamano:       $([math]::Round($info.Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""
Warn "ATENCION: se van a REEMPLAZAR todos los datos actuales por los del backup."
if (!$Yes) {
  $ok = Read-Host "Continuar? (S/N)"
  if ($ok -notmatch '^[sSyY]') { Log "Cancelado."; return }
}

# --- 2) configuracion (se genera sola la primera vez) ----------------------
function New-Secret([int]$n) {
  $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  -join (1..$n | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

$cfg = @{}
if (Test-Path $configPath) {
  Get-Content $configPath | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } | ForEach-Object {
    $i = $_.IndexOf('='); if ($i -gt 0) { $cfg[$_.Substring(0,$i).Trim()] = $_.Substring($i+1).Trim() }
  }
}

$teniaData = Test-Path (Join-Path $dataDir 'PG_VERSION')
if ($teniaData -and !$cfg.ContainsKey('POSTGRES_PASSWORD')) {
  Fail "Falta config.env y ya existe una base de datos. No se puede restaurar sin la contrasena. Copia el config.env de la PC original o restaura sobre una instalacion limpia."
}

if (!$cfg.ContainsKey('POSTGRES_USER'))         { $cfg.POSTGRES_USER = 'autoservicio' }
if (!$cfg.ContainsKey('POSTGRES_PASSWORD'))     { $cfg.POSTGRES_PASSWORD = (New-Secret 24) }
if (!$cfg.ContainsKey('POSTGRES_DB'))           { $cfg.POSTGRES_DB = 'autoservicio' }
if (!$cfg.ContainsKey('POSTGRES_APP_USER'))     { $cfg.POSTGRES_APP_USER = 'autoservicio_app' }
if (!$cfg.ContainsKey('POSTGRES_APP_PASSWORD')) { $cfg.POSTGRES_APP_PASSWORD = 'autoservicioapp123' }
if (!$cfg.ContainsKey('PGPORT'))                { $cfg.PGPORT = '5433' }
if (!$cfg.ContainsKey('APP_PORT'))              { $cfg.APP_PORT = '3000' }
if (!$cfg.ContainsKey('APP_VERSION'))           { $cfg.APP_VERSION = '1.1.0' }
if (!$cfg.ContainsKey('JWT_SECRET'))            { $cfg.JWT_SECRET = (New-Secret 48) }
if (!$cfg.ContainsKey('JWT_EXPIRES_IN'))        { $cfg.JWT_EXPIRES_IN = '30d' }
if (!$cfg.ContainsKey('PROVIDER_USER'))         { $cfg.PROVIDER_USER = 'Jupiter' }
if (!$cfg.ContainsKey('PROVIDER_PASSWORD'))     { $cfg.PROVIDER_PASSWORD = 'Proveedor21' }
($cfg.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)=$($_.Value)" }) | Set-Content -Path $configPath -Encoding ASCII

$env:PGPASSWORD = $cfg.POSTGRES_PASSWORD

# --- 3) inicializar PostgreSQL (solo la primera vez) ----------------------
if (!$teniaData) {
  Log "Primera ejecucion: inicializando la base de datos..."
  if (!(Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
  $pwfile = Join-Path $logsDir 'pw.tmp'
  Set-Content -Path $pwfile -Value $cfg.POSTGRES_PASSWORD -NoNewline -Encoding ASCII
  $initdbLog = Join-Path $logsDir 'initdb.log'
  $rc = Invoke-Tool (Join-Path $pgBin 'initdb.exe') -Arguments @('-D', $dataDir, '-U', $cfg.POSTGRES_USER, '-A', 'scram-sha-256', "--pwfile=$pwfile", '-E', 'UTF8', '--locale=C') -LogFile $initdbLog
  if ($rc -ne 0) {
    Remove-Item $pwfile -Force -ErrorAction SilentlyContinue
    Fail "Fallo initdb. Detalle en logs\initdb.log."
  }
  Remove-Item $pwfile -Force -ErrorAction SilentlyContinue
  Add-Content -Path (Join-Path $dataDir 'postgresql.conf') "`nport = $($cfg.PGPORT)`nlisten_addresses = '127.0.0.1'`n"
}

# --- 4) arrancar PostgreSQL si no esta corriendo --------------------------
$pgLog = Join-Path $logsDir 'postgres.log'
$rc = Invoke-Tool $pgCtl -Arguments @('-D', $dataDir, 'status') -Quiet
if ($rc -ne 0) {
  $pidFile = Join-Path $dataDir 'postmaster.pid'
  $pgProc  = Get-Process -Name 'postgres' -ErrorAction SilentlyContinue
  if ((Test-Path $pidFile) -and (-not $pgProc)) {
    Log "Limpiando bloqueo anterior (postmaster.pid)..."
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }
  Log "Iniciando PostgreSQL (puerto $($cfg.PGPORT))..."
  $rc = Invoke-Tool $pgCtl -Arguments @('-D', $dataDir, '-l', $pgLog, '-o', "-p $($cfg.PGPORT) -c listen_addresses=127.0.0.1", 'start', '-w', '-t', '120')
  if ($rc -ne 0) {
    $err = if (Test-Path $pgLog) { ((Get-Content $pgLog -Tail 10) -join ' | ') } else { '' }
    Fail "PostgreSQL no respondio. $err"
  }
}

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  $rc = Invoke-Tool $pgReady -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER) -Quiet
  if ($rc -eq 0) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
if (!$ready) {
  $err = if (Test-Path $pgLog) { ((Get-Content $pgLog -Tail 10) -join ' | ') } else { '' }
  Fail "PostgreSQL no respondio. $err"
}

# --- 5) crear la base si no existe ----------------------------------------
$exists = Invoke-Tool $psql -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, '-d', 'postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname='$($cfg.POSTGRES_DB)'") -Capture
if ($exists -ne '1') {
  Log "Creando base de datos $($cfg.POSTGRES_DB)..."
  $rc = Invoke-Tool $createdb -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, $cfg.POSTGRES_DB)
  if ($rc -ne 0) { Fail "No se pudo crear la base de datos." }
}

# --- 6) detener la aplicacion (para que no bloquee la restauracion) -------
$procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*dist\main*' -or $_.CommandLine -like '*dist/main*' }
foreach ($p in $procs) {
  Log "Deteniendo la aplicacion (PID $($p.ProcessId))..."
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
if ($procs) { Start-Sleep -Seconds 2 }

# --- 7) backup de seguridad de los datos actuales -------------------------
$tablas = Invoke-Tool $psql -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, '-d', $cfg.POSTGRES_DB, '-tAc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'") -Capture
if ($tablas -match '^\d+$' -and [int]$tablas -gt 0) {
  if (!(Test-Path $backupsDir)) { New-Item -ItemType Directory -Path $backupsDir | Out-Null }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $prev  = Join-Path $backupsDir "autoservicio-pre-restore-$stamp.dump"
  Log "Guardando backup de seguridad de los datos actuales..."
  $rc = Invoke-Tool $pgDump -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, '-d', $cfg.POSTGRES_DB, '-F', 'c', '-f', $prev) -Quiet
  if ($rc -ne 0) { Fail "No se pudo generar el backup de seguridad. Se cancela la restauracion." }
  Log "Backup de seguridad: $prev"
}

# --- 8) vaciar la base y restaurar ----------------------------------------
Log "Vaciando la base actual..."
$rc = Invoke-Tool $psql -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, '-d', $cfg.POSTGRES_DB, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;') -Quiet
if ($rc -ne 0) { Fail "No se pudo vaciar la base de datos." }

if ($esCustom) {
  Log "Restaurando backup (esto puede tardar unos minutos)..."
  $rc = Invoke-Tool $pgRestore -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, '-d', $cfg.POSTGRES_DB, '--no-owner', '--no-privileges', $Backup)
  if ($rc -ge 2) { Fail "Fallo pg_restore (codigo $rc). Revisa que el backup sea valido." }
  if ($rc -eq 1) { Warn "La restauracion termino con advertencias (se ignoraron)." }
} else {
  Log "Restaurando backup SQL (esto puede tardar unos minutos)..."
  $rc = Invoke-Tool $psql -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, '-d', $cfg.POSTGRES_DB, '-v', 'ON_ERROR_STOP=1', '-f', $Backup)
  if ($rc -ne 0) { Fail "Fallo la restauracion del archivo SQL." }
}

# --- 9) verificar ----------------------------------------------------------
$tablasFinal = Invoke-Tool $psql -Arguments @('-h', '127.0.0.1', '-p', $cfg.PGPORT, '-U', $cfg.POSTGRES_USER, '-d', $cfg.POSTGRES_DB, '-tAc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'") -Capture
if ($tablasFinal -notmatch '^\d+$' -or [int]$tablasFinal -eq 0) {
  Fail "La restauracion no creo tablas. Revisa el archivo de backup."
}
Log "Restauracion completa ($tablasFinal tablas)."

# --- 10) iniciar el sistema con los datos restaurados ---------------------
if ($NoStart) {
  Log "Listo. Ejecuta iniciar.bat para usar el sistema."
  return
}

$iniciar = Join-Path $PSScriptRoot 'iniciar.ps1'
if (Test-Path $iniciar) {
  Log "Iniciando el sistema..."
  & $iniciar -NoPause
} else {
  Log "Listo. Ejecuta iniciar.bat para usar el sistema."
}
