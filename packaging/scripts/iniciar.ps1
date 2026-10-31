param(
  [switch]$NoBrowser,
  [switch]$NoPause
)

# ---------------------------------------------------------------------------
#  Autoservicio - arranque en un unico equipo (Windows, sin Docker)
#  - Inicializa PostgreSQL embebido (solo la primera vez)
#  - Aplica el esquema (prisma db push) y Row Level Security
#  - Levanta la aplicacion (API + frontend) en http://localhost:APP_PORT
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Log([string]$m)  { Write-Host "[autoservicio] $m" -ForegroundColor Cyan }
function Fail([string]$m) { Write-Host "[autoservicio] $m" -ForegroundColor Red; if (-not $NoPause) { Read-Host "Enter para cerrar" }; exit 1 }

$node       = Join-Path $root 'node\node.exe'
$pgBin      = Join-Path $root 'pgsql\bin'
$dataDir    = Join-Path $root 'data'
$logsDir    = Join-Path $root 'logs'
$appDir     = Join-Path $root 'app'
$configPath = Join-Path $root 'config.env'
$versionFile = Join-Path $root 'app-version.txt'
$backupsDir = Join-Path $root 'backups'

if (!(Test-Path $logsDir))   { New-Item -ItemType Directory -Path $logsDir | Out-Null }
if (!(Test-Path $node))      { Fail "No se encontro node\node.exe. Bundle incompleto." }
if (!(Test-Path $pgBin))     { Fail "No se encontro pgsql\bin. Bundle incompleto." }
if (!(Test-Path $appDir))    { Fail "No se encontro la carpeta app. Bundle incompleto." }

function New-Secret([int]$n) {
  $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  -join (1..$n | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

# --- configuración (se genera sola la primera vez) ---
$cfg = @{}
if (Test-Path $configPath) {
  Get-Content $configPath | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' } | ForEach-Object {
    $i = $_.IndexOf('='); if ($i -gt 0) { $cfg[$_.Substring(0,$i).Trim()] = $_.Substring($i+1).Trim() }
  }
}
if (!$cfg.ContainsKey('POSTGRES_USER'))         { $cfg.POSTGRES_USER = 'autoservicio' }
if (!$cfg.ContainsKey('POSTGRES_PASSWORD'))     { $cfg.POSTGRES_PASSWORD = (New-Secret 24) }
if (!$cfg.ContainsKey('POSTGRES_DB'))           { $cfg.POSTGRES_DB = 'autoservicio' }
if (!$cfg.ContainsKey('POSTGRES_APP_USER'))     { $cfg.POSTGRES_APP_USER = 'autoservicio_app' }
if (!$cfg.ContainsKey('POSTGRES_APP_PASSWORD')) { $cfg.POSTGRES_APP_PASSWORD = 'autoservicioapp123' } # debe coincidir con prisma\rls.sql
if (!$cfg.ContainsKey('PGPORT'))                { $cfg.PGPORT = '5433' }
if (!$cfg.ContainsKey('APP_PORT'))              { $cfg.APP_PORT = '3000' }
if (!$cfg.ContainsKey('APP_VERSION'))           { $cfg.APP_VERSION = '1.1.0' }
if (!$cfg.ContainsKey('JWT_SECRET'))            { $cfg.JWT_SECRET = (New-Secret 48) }
if (!$cfg.ContainsKey('JWT_EXPIRES_IN'))        { $cfg.JWT_EXPIRES_IN = '30d' }
if (!$cfg.ContainsKey('PROVIDER_USER'))         { $cfg.PROVIDER_USER = 'Jupiter' }
if (!$cfg.ContainsKey('PROVIDER_PASSWORD'))     { $cfg.PROVIDER_PASSWORD = 'Proveedor21' }
($cfg.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)=$($_.Value)" }) | Set-Content -Path $configPath -Encoding ASCII

$versionActual = $cfg.APP_VERSION
$versionAnterior = if (Test-Path $versionFile) { (Get-Content $versionFile -TotalCount 1).Trim() } else { '' }
$env:PGPASSWORD = $cfg.POSTGRES_PASSWORD
$host_ = "127.0.0.1:$($cfg.PGPORT)"

# --- 1) initdb (solo la primera vez) ---
if (!(Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  Log "Primera ejecucion: inicializando la base de datos..."
  if (!(Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
  $pwfile = Join-Path $logsDir 'pw.tmp'
  Set-Content -Path $pwfile -Value $cfg.POSTGRES_PASSWORD -NoNewline -Encoding ASCII
  $initdbLog = Join-Path $logsDir 'initdb.log'
  & (Join-Path $pgBin 'initdb.exe') -D $dataDir -U $cfg.POSTGRES_USER -A scram-sha-256 --pwfile=$pwfile -E UTF8 --locale=C *>&1 | Tee-Object -FilePath $initdbLog
  if ($LASTEXITCODE -ne 0) {
    Remove-Item $pwfile -Force -ErrorAction SilentlyContinue
    Fail "Fallo initdb. Detalle en logs\initdb.log (¿falta el runtime de Visual C++? msvcp140.dll / vcruntime140.dll)."
  }
  Remove-Item $pwfile -Force -ErrorAction SilentlyContinue
  Add-Content -Path (Join-Path $dataDir 'postgresql.conf') "`nport = $($cfg.PGPORT)`nlisten_addresses = '127.0.0.1'`n"
}

# --- 2) arrancar PostgreSQL ---
$pgctl = Join-Path $pgBin 'pg_ctl.exe'
$pgLog = Join-Path $logsDir 'postgres.log'
$pgOut = Join-Path $logsDir 'postgres.out'

& $pgctl -D $dataDir status *> $null
if ($LASTEXITCODE -ne 0) {
  # Si quedo un archivo de bloqueo de un arranque anterior (por corte o suspension),
  # borralo solo si no hay ningun postgres corriendo. Los datos no se tocan.
  $pidFile = Join-Path $dataDir 'postmaster.pid'
  $pgProc  = Get-Process -Name 'postgres' -ErrorAction SilentlyContinue
  if ((Test-Path $pidFile) -and (-not $pgProc)) {
    Log "Limpiando bloqueo anterior (postmaster.pid)..."
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }

  Log "Iniciando PostgreSQL (puerto $($cfg.PGPORT))..."
  # pg_ctl con -w espera a que el motor termine el arranque y no cae por el 'starting up'.
  & $pgctl -D $dataDir -l $pgLog -o "-p $($cfg.PGPORT) -c listen_addresses=127.0.0.1" start -w -t 120
  if ($LASTEXITCODE -ne 0) {
    $err = if (Test-Path $pgLog) { ((Get-Content $pgLog -Tail 10) -join ' | ') } else { '' }
    Fail "PostgreSQL no respondio. $err"
  }
}

# Espera corta final para asegurar que responda a conexiones
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p $cfg.PGPORT -U $cfg.POSTGRES_USER *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
if (!$ready) {
  $err = if (Test-Path $pgLog) { ((Get-Content $pgLog -Tail 10) -join ' | ') } else { '' }
  Fail "PostgreSQL no respondio. $err"
}

# --- 3) crear la base si no existe ---
$psql = Join-Path $pgBin 'psql.exe'
$exists = "$(& $psql -h 127.0.0.1 -p $cfg.PGPORT -U $cfg.POSTGRES_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$($cfg.POSTGRES_DB)'")".Trim()
if ($exists -ne '1') {
  Log "Creando base de datos $($cfg.POSTGRES_DB)..."
  & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $cfg.PGPORT -U $cfg.POSTGRES_USER $cfg.POSTGRES_DB
}

# --- 4) backup previo si hay actualizacion detectada y la DB ya existia ---
if (-not (Test-Path $versionFile) -or $versionAnterior -ne $versionActual) {
  $backupStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $dumpPath = Join-Path $backupsDir "autoservicio-upgrade-$backupStamp.dump"

  if (Test-Path (Join-Path $root 'data\PG_VERSION')) {
    $actualDbExists = "$(& $psql -h 127.0.0.1 -p $cfg.PGPORT -U $cfg.POSTGRES_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$($cfg.POSTGRES_DB)'")".Trim()
    if ($actualDbExists -eq '1') {
      Log "Actualizacion detectada ($versionAnterior -> $versionActual). Generando backup de seguridad antes de aplicar cambios..."
      if (!(Test-Path $backupsDir)) { New-Item -ItemType Directory -Path $backupsDir | Out-Null }
      & (Join-Path $pgBin 'pg_dump.exe') -h 127.0.0.1 -p $cfg.PGPORT -U $cfg.POSTGRES_USER -d $cfg.POSTGRES_DB -F c -f $dumpPath
      if ($LASTEXITCODE -ne 0) { Fail "No se pudo crear el backup previo a la actualizacion. Revisa la DB y vuelve a intentar." }
      Log "Backup de seguridad listo: $dumpPath"
    } else {
      Log "No hay una base previa para respaldar; se inicializa desde cero."
    }
  }

  $versionActual | Set-Content -Path $versionFile -Encoding ASCII
}

# --- 5) esquema + RLS ---
$prismaCli = Join-Path $appDir 'node_modules\prisma\build\index.js'
$appUrl    = "postgresql://$($cfg.POSTGRES_APP_USER):$($cfg.POSTGRES_APP_PASSWORD)@$host_/$($cfg.POSTGRES_DB)?schema=public"
$migUrl    = "postgresql://$($cfg.POSTGRES_USER):$($cfg.POSTGRES_PASSWORD)@$host_/$($cfg.POSTGRES_DB)?schema=public"

Log "Aplicando esquema de base de datos..."
$env:DATABASE_URL = $migUrl
Push-Location $appDir
& $node $prismaCli db push --skip-generate --accept-data-loss
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Fallo prisma db push." }
Log "Aplicando seguridad por fila (RLS)..."
& $node $prismaCli db execute --url $migUrl --file prisma/rls.sql
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Fallo RLS." }
Pop-Location

# --- 6) arrancar la aplicacion (en segundo plano, sin ventana) ---
$env:DATABASE_URL    = $appUrl
$env:JWT_SECRET      = $cfg.JWT_SECRET
$env:JWT_EXPIRES_IN  = $cfg.JWT_EXPIRES_IN
$env:PROVIDER_USER   = $cfg.PROVIDER_USER
$env:PROVIDER_PASSWORD = $cfg.PROVIDER_PASSWORD
$env:PORT            = $cfg.APP_PORT
$env:WEB_DIR         = Join-Path $appDir 'public'
$env:NODE_ENV        = 'production'

$running = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*dist\main*' -or $_.CommandLine -like '*dist/main*' }
if ($running) {
  Log "La aplicacion ya estaba en ejecucion."
} else {
  Log "Iniciando la aplicacion (en segundo plano)..."
  Start-Process -FilePath $node -ArgumentList 'dist/main.js' -WorkingDirectory $appDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logsDir 'app.log') `
    -RedirectStandardError  (Join-Path $logsDir 'app.err') | Out-Null
}

# esperar a que el puerto responda
$appPort = [int]$cfg.APP_PORT
$up = $false
for ($i = 0; $i -lt 120; $i++) {
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $appPort); $c.Close(); $up = $true; break }
  catch { Start-Sleep -Milliseconds 500 }
}

Log "Aplicacion lista en http://localhost:$($cfg.APP_PORT)"
Log "(Panel de proveedor para crear la empresa: http://localhost:$($cfg.APP_PORT)/proveedor)"
Log "Se ejecuta en segundo plano. Para detener: ejecuta detener.bat"
if (!$NoBrowser) { Start-Process "http://localhost:$($cfg.APP_PORT)" }
