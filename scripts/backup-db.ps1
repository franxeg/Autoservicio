param(
    [int]$Guardar = 14
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $raiz 'backups'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$envFile = Get-Content (Join-Path $raiz '.env') | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') }
function Get-Valor([string]$clave) {
    $linea = $envFile | Where-Object { $_ -match "^$clave=" } | Select-Object -First 1
    if (-not $linea) { throw "Falta $clave en el .env de la raiz" }
    return $linea.Substring($linea.IndexOf('=') + 1).Trim()
}
$db = Get-Valor 'POSTGRES_DB'
$user = Get-Valor 'POSTGRES_USER'
$pass = Get-Valor 'POSTGRES_PASSWORD'
$contenedor = 'autoservicio_db'
$fecha = Get-Date -Format 'yyyyMMdd_HHmm'
$destino = Join-Path $dir "autoservicio_$fecha.dump"
docker exec -e PGPASSWORD=$pass $contenedor pg_dump -U $user -d $db -Fc -f /tmp/autoservicio.dump
if ($LASTEXITCODE -ne 0) { throw 'Falló pg_dump' }
docker cp "${contenedor}:/tmp/autoservicio.dump" $destino
if ($LASTEXITCODE -ne 0) { throw 'Falló docker cp' }
docker exec $contenedor rm -f /tmp/autoservicio.dump
Get-ChildItem $dir -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Guardar | Remove-Item -Force
Write-Host "Backup OK: $destino"