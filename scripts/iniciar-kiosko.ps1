param(
    [string]$Url = 'http://localhost:5173'
)
$ErrorActionPreference = 'Stop'
$candidatos = @(
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
)
$navegador = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $navegador) { throw 'No hay Edge ni Chrome instalados' }
Start-Process $navegador -ArgumentList '--kiosk', $Url
Write-Host "Kiosko abierto en $Url"