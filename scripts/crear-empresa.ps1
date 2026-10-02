param(
  [string]$Empresa,
  [string]$Cuit,
  [string]$Usuario
)

$ErrorActionPreference = "Stop"
$base = "http://localhost:3000/api"

# Lee las credenciales de proveedor del archivo backend/.env
$envFile = Join-Path $PSScriptRoot "..\backend\.env"
if (-not (Test-Path $envFile)) { Write-Error "No se encuentra backend/.env"; exit 1 }
$envs = Get-Content $envFile
$providerUser = (Select-String -InputObject ($envs | Out-String) -Pattern 'PROVIDER_USER="?(?<v>[^"\r\n]+)' | ForEach-Object { $_.Matches[0].Groups['v'].Value })
$providerPass = (Select-String -InputObject ($envs | Out-String) -Pattern 'PROVIDER_PASSWORD="?(?<v>[^"\r\n]+)' | ForEach-Object { $_.Matches[0].Groups['v'].Value })
if (-not $providerUser -or -not $providerPass) { Write-Error "Falta PROVIDER_USER/PROVIDER_PASSWORD en backend/.env"; exit 1 }

# Pide datos faltantes
if (-not $Empresa) { $Empresa = Read-Host "Nombre de la empresa (ej: Verduleria Los Gomez)" }
if (-not $Usuario) {
  $slug = ($Empresa -replace '[^a-zA-Z0-9]+', '').ToLower()
  $defaultUsuario = "setup$slug"
  $Usuario = Read-Host "Usuario temporal para el cliente (Enter para '$defaultUsuario')"
  if (-not $Usuario) { $Usuario = $defaultUsuario }
}
if (-not $Cuit) {
  $c = Read-Host "CUIT (opcional, Enter para omitirlo)"
  if ($c) { $Cuit = $c }
}

Write-Host ""
Write-Host "Autenticando como proveedor ..." -ForegroundColor Cyan
$login = Invoke-RestMethod -Uri "$base/auth/login-proveedor" -Method Post -ContentType "application/json" -Body (@{ usuario = $providerUser; password = $providerPass } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.access_token)" }

Write-Host "Creando empresa '$Empresa' ..." -ForegroundColor Cyan
$cuitParam = $null
if ($Cuit) { $cuitParam = $Cuit }
$body = @{
  nombreEmpresa = $Empresa
  cuit          = $cuitParam
  usuarioSetup  = $Usuario
} | ConvertTo-Json

$resp = Invoke-RestMethod -Uri "$base/auth/crear-empresa" -Method Post -Headers $headers -ContentType "application/json" -Body $body

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  EMPRESA CREADA: $($resp.empresa.nombre)  (id: $($resp.empresa.id))" -ForegroundColor Green
Write-Host "  Sucursal inicial: $($resp.sucursal.nombre)" -ForegroundColor Green
Write-Host ""
Write-Host "  CREDENCIALES PARA ENTREGAR AL CLIENTE:" -ForegroundColor Yellow
Write-Host "  Usuario temporal: $($resp.credenciales.usuario)" -ForegroundColor Yellow
Write-Host "  Contrasena:       $($resp.credenciales.password)" -ForegroundColor Yellow
Write-Host ""
Write-Host "El cliente entra con estas credenciales y debera" -ForegroundColor Cyan
Write-Host "crear su propio usuario/administrador al primer ingreso." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green