param(
  [string]$NodeZip = "$env:TEMP\opencode\node-v20.20.2-win-x64.zip",
  [string]$PgZip   = "$env:TEMP\opencode\postgresql-16.15-5-windows-x64-binaries.zip",
  [string]$Out     = "release",
  [switch]$SkipBuild
)

# ---------------------------------------------------------------------------
#  Construye el bundle autonomo para Windows (sin Docker):
#    release\node      -> Node portable
#    release\pgsql     -> PostgreSQL portable
#    release\app       -> backend compilado + frontend (app\public)
#    release\scripts   -> launcher (iniciar/detener/backup)
#  Uso:  powershell -ExecutionPolicy Bypass -File scripts\construir-release.ps1
# ---------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repo $Out

function Log([string]$m) { Write-Host "[build] $m" -ForegroundColor Cyan }
function Robo($src, $dst, $extra = @()) {
  $args = @($src, $dst, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1') + $extra
  & robocopy @args | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy fallo ($LASTEXITCODE): $src -> $dst" }
  $global:LASTEXITCODE = 0
}

if (!(Test-Path $NodeZip)) { throw "No existe el zip de Node: $NodeZip" }
if (!(Test-Path $PgZip))   { throw "No existe el zip de PostgreSQL: $PgZip" }

# --- 1) builds ---
if (!$SkipBuild) {
  Log "Instalando dependencias del frontend..."
  Push-Location (Join-Path $repo 'frontend')
  npm.cmd install --no-audit --no-fund
  Pop-Location

  Log "Build del frontend..."
  Push-Location (Join-Path $repo 'frontend'); npm.cmd run build; Pop-Location

  Log "Build del backend..."
  Push-Location (Join-Path $repo 'backend')
  npm.cmd install --no-audit --no-fund
  npm.cmd run prisma:generate
  npm.cmd run build
  Pop-Location
}

if (!(Test-Path (Join-Path $repo 'frontend\dist\index.html'))) { throw "Falta frontend\dist. Corre el build." }
if (!(Test-Path (Join-Path $repo 'backend\dist\main.js')))      { throw "Falta backend\dist\main.js. Corre el build." }

# --- 2) limite ---
Log "Limpiando $outDir ..."
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null

# --- 3) app ---
Log "Armando app/ ..."
$appOut = Join-Path $outDir 'app'
New-Item -ItemType Directory -Path $appOut | Out-Null
Robo (Join-Path $repo 'backend\dist')   (Join-Path $appOut 'dist')
Robo (Join-Path $repo 'backend\prisma') (Join-Path $appOut 'prisma')
Copy-Item (Join-Path $repo 'backend\package.json') $appOut
Log "Copiando node_modules (puede tardar)..."
Robo (Join-Path $repo 'backend\node_modules') (Join-Path $appOut 'node_modules')
Log "Copiando frontend a app\public ..."
Robo (Join-Path $repo 'frontend\dist') (Join-Path $appOut 'public')

# Quitar dependencias de desarrollo (typescript, @nestjs/cli, ts-node, etc.).
# 'prisma' queda porque es dependency (se usa para db push / RLS en runtime).
Log "Podando dependencias de desarrollo..."
Copy-Item (Join-Path $repo 'backend\package-lock.json') $appOut -Force
Push-Location $appOut
& npm.cmd prune --omit=dev --no-audit --no-fund
Pop-Location

# --- 4) Node portable ---
Log "Extrayendo Node portable (tar)..."
$tmpNode = Join-Path $outDir '_node_tmp'
New-Item -ItemType Directory -Path $tmpNode | Out-Null
& tar.exe -xf $NodeZip -C $tmpNode
if ($LASTEXITCODE -ne 0) { throw "Fallo extrayendo Node" }
$nodeInner = Get-ChildItem $tmpNode -Directory | Select-Object -First 1
Move-Item $nodeInner.FullName (Join-Path $outDir 'node')
Remove-Item $tmpNode -Recurse -Force

# --- 5) PostgreSQL portable ---
Log "Extrayendo PostgreSQL portable (tar)..."
& tar.exe -xf $PgZip -C $outDir --exclude "pgsql/pgAdmin 4" --exclude "pgsql/StackBuilder" --exclude "pgsql/doc" --exclude "pgsql/include" --exclude "pgsql/symbols"
if ($LASTEXITCODE -ne 0) { throw "Fallo extrayendo PostgreSQL" }
# El zip trae una carpeta 'pgsql'. Quitamos lo que no hace falta para achicar.
$pgsql = Join-Path $outDir 'pgsql'
foreach ($extra in @('pgAdmin 4','StackBuilder','doc','symbols','include')) {
  $p = Join-Path $pgsql $extra
  for ($t = 0; $t -lt 3 -and (Test-Path $p); $t++) {
    Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $p) { Start-Sleep -Seconds 2 }
  }
  if (Test-Path $p) { Log "ADVERTENCIA: no se pudo borrar $extra" }
}

# Runtime de Visual C++ requerido por los binarios/DLLs de PostgreSQL (ICU usa MSVCP140).
# No viene con Windows; si falta, initdb/postgres no arrancan.
foreach ($dll in @('msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll')) {
  $src = Join-Path $env:SystemRoot "System32\$dll"
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $pgsql "bin\$dll") -Force
    Log "Incluida $dll"
  } else {
    Log "ADVERTENCIA: no se encontro $dll en System32"
  }
}

# --- 6) launcher ---
Log "Copiando launcher..."
Copy-Item (Join-Path $repo 'packaging\*.bat') $outDir
Copy-Item (Join-Path $repo 'packaging\LEEME.txt') $outDir
Robo (Join-Path $repo 'packaging\scripts') (Join-Path $outDir 'scripts')
foreach ($d in @('logs','backups')) { New-Item -ItemType Directory -Path (Join-Path $outDir $d) | Out-Null }

$size = [math]::Round((Get-ChildItem $outDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 0)
Log "Listo. Bundle en '$outDir' ($size MB). Para probar: $Out\iniciar.bat"
