$ErrorActionPreference = "Stop"
$base = "http://localhost:3000/api"

function Login($u, $p) {
  $t = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{ usuario = $u; password = $p } | ConvertTo-Json)
  @{ Authorization = "Bearer $($t.access_token)" }
}

function Count($headers, $path, $prop) {
  (Invoke-RestMethod -Uri "$base/$path" -Headers $headers).$prop.Count
}

function Sucursal($headers) {
  (Invoke-RestMethod -Uri "$base/sucursales" -Headers $headers)[0].id
}

# ---------- SNAPSHOT inicial de las empresas existentes ----------
$hDemo  = Login "admin" "admin123"
$hSol   = Login "laura" "laura123"

$demo = @{
  cate  = Count $hDemo "categorias" ""
  prod  = Count $hDemo "productos" "data"
  ventas = (Invoke-RestMethod -Uri "$base/reportes/dashboard?sucursalId=$(Sucursal $hDemo)" -Headers $hDemo).ventasHoy.total
}
$sol = @{
  cate  = Count $hSol "categorias" ""
  prod  = Count $hSol "productos" "data"
  ventas = (Invoke-RestMethod -Uri "$base/reportes/dashboard?sucursalId=$(Sucursal $hSol)" -Headers $hSol).ventasHoy.total
}
Write-Output "SNAPSHOT antes -> DEMO: cat=$($demo.cate) prod=$($demo.prod) ventas=$($demo.ventas) | EL SOL: cat=$($sol.cate) prod=$($sol.prod) ventas=$($sol.ventas)"

# ---------- 1) Crear empresa nueva ----------
$suffix = Get-Date -Format "yyyyMMddHHmmss"
$nueva = Invoke-RestMethod -Uri "$base/auth/registro-empresa" -Method Post -ContentType "application/json" -Body (@{
  nombreEmpresa = "Empresa Test $suffix"
  cuit          = "30-$((Get-Random -Minimum 10000000 -Maximum 99999999))-$suffix.Substring(4,2)"
  nombre        = "Usuario Test"
  usuario       = "test$suffix"
  email         = "test$suffix@gmail.com"
  password      = "test123"
} | ConvertTo-Json)
$hNew = Login "test$suffix" "test123"
Write-Output "1) EMPRESA NUEVA creada: '$($nueva.empresa.nombre)' ($($nueva.empresa.id)) sucursal='$($nueva.sucursal.nombre)'"

# ---------- 2) Llenarla con datos ----------
$cat     = Invoke-RestMethod -Uri "$base/categorias" -Method Post -Headers $hNew -ContentType "application/json" -Body (@{ nombre = "Categoria Test" } | ConvertTo-Json)
$suc     = (Invoke-RestMethod -Uri "$base/sucursales" -Headers $hNew)[0]
$prod    = Invoke-RestMethod -Uri "$base/productos" -Method Post -Headers $hNew -ContentType "application/json" -Body (@{
  nombre = "Producto Test"; codigoBarras = "7799$((Get-Random -Minimum 100000 -Maximum 999999))"
  precioCosto = 500; precioVenta = 900; categoriaId = $cat.id; stockInicial = 20; sucursalId = $suc.id
} | ConvertTo-Json)
$caja    = Invoke-RestMethod -Uri "$base/caja/abrir" -Method Post -Headers $hNew -ContentType "application/json" -Body (@{ sucursalId = $suc.id; montoInicial = 10000 } | ConvertTo-Json)
$venta   = Invoke-RestMethod -Uri "$base/ventas" -Method Post -Headers $hNew -ContentType "application/json" -Body (@{
  sucursalId = $suc.id; cajaId = $caja.id
  items = @(@{ productoId = $prod.id; cantidad = 1; precioUnitario = 900 })
  metodoPago = "EFECTIVO"
} | ConvertTo-Json -Depth 5)
Write-Output "2) DATOS NUEVOS: categoria='$($cat.nombre)' producto='$($prod.nombre)' venta nro=$($venta.nroComprobante) total=$($venta.total)"
$dashNew = Invoke-RestMethod -Uri "$base/reportes/dashboard?sucursalId=$($suc.id)" -Headers $hNew
Write-Output "   La empresa nueva VE: categorias=$((Invoke-RestMethod -Uri "$base/categorias" -Headers $hNew).Count) productos=$((Invoke-RestMethod -Uri "$base/productos" -Headers $hNew).data.Count) ventasHoy=$($dashNew.ventasHoy.total)"

# ---------- 3) Verificar que NADIE ve los datos de la otra ----------
$d2 = @{
  cate  = Count $hDemo "categorias" ""
  prod  = Count $hDemo "productos" "data"
  ventas = (Invoke-RestMethod -Uri "$base/reportes/dashboard?sucursalId=$(Sucursal $hDemo)" -Headers $hDemo).ventasHoy.total
}
$s2 = @{
  cate  = Count $hSol "categorias" ""
  prod  = Count $hSol "productos" "data"
  ventas = (Invoke-RestMethod -Uri "$base/reportes/dashboard?sucursalId=$(Sucursal $hSol)" -Headers $hSol).ventasHoy.total
}
Write-Output "3) SNAPSHOT despues -> DEMO: cat=$($d2.cate) prod=$($d2.prod) ventas=$($d2.ventas) | EL SOL: cat=$($s2.cate) prod=$($s2.prod) ventas=$($s2.ventas)"

$okDemo = ($d2.cate -eq $demo.cate) -and ($d2.prod -eq $demo.prod) -and ($d2.ventas -eq $demo.ventas)
$okSol  = ($s2.cate -eq $sol.cate)  -and ($s2.prod -eq $sol.prod)  -and ($s2.ventas -eq $sol.ventas)
$okNew  = ((Invoke-RestMethod -Uri "$base/categorias" -Headers $hNew).Count -eq 1) -and ((Invoke-RestMethod -Uri "$base/productos" -Headers $hNew).data.Count -eq 1)

Write-Output ""
Write-Output ("DEMO no afectado:      " + $(if ($okDemo) { "OK" } else { "FALLO" }))
Write-Output ("EL SOL no afectado:    " + $(if ($okSol) { "OK" } else { "FALLO" }))
Write-Output ("NUEVA ve solo lo suyo: " + $(if ($okNew) { "OK" } else { "FALLO" }))
if ($okDemo -and $okSol -and $okNew) { Write-Output ">>> AISLAMIENTO VERIFICADO" } else { Write-Output ">>> HAY FUGAS DE DATOS"; exit 1 }