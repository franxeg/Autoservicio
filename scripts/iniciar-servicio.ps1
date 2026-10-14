$ErrorActionPreference = 'SilentlyContinue'
$dockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
    Start-Process $dockerExe
    $init = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 2
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { $init = $true; break }
    }
    if (-not $init) { throw 'Docker Desktop no inició en 120s' }
}
$raiz = Split-Path $PSScriptRoot -Parent
Push-Location $raiz
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw 'Falló docker compose up' }
    Write-Host 'Sistema arriba en http://localhost:5173'
} finally {
    Pop-Location
}