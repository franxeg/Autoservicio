import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { fechaCorta, horaCorta } from '../lib/fecha';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function Movimientos() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || undefined;

  const ahora = new Date();
  const [mes, setMes] = useState(ahora.getMonth());
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [seleccion, setSeleccion] = useState<{ desde: string; hasta: string; etiqueta: string } | null>(null);
  const [data, setData] = useState<any>(null);
  const [cargando, setCargando] = useState(false);

  const celdas = useMemo(() => {
    const total = new Date(anio, mes + 1, 0).getDate();
    const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const lista: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) lista.push(d);
    while (lista.length % 7 !== 0) lista.push(null);
    return lista;
  }, [mes, anio]);

  const moverMes = (paso: number) => {
    const f = new Date(anio, mes + paso, 1);
    setMes(f.getMonth());
    setAnio(f.getFullYear());
  };

  const elegirDia = (d: number) => {
    const s = iso(anio, mes, d);
    setSeleccion({ desde: s, hasta: s, etiqueta: `${String(d).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${anio}` });
  };

  const elegirMes = () => {
    const ultimo = new Date(anio, mes + 1, 0).getDate();
    setSeleccion({ desde: iso(anio, mes, 1), hasta: iso(anio, mes, ultimo), etiqueta: `${MESES[mes]} ${anio}` });
  };

  useEffect(() => {
    if (!seleccion) { setData(null); return; }
    setCargando(true);
    api.get('/reportes/movimientos', { params: { sucursalId, desde: seleccion.desde, hasta: seleccion.hasta } })
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setCargando(false));
  }, [seleccion, sucursalId]);

  const th: React.CSSProperties = { padding: '8px 6px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: 13, color: '#374151' };
  const td: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #f3f4f6', fontSize: 13 };

  const cajaResumen = (titulo: string, valor: number, color: string, sub?: string) => (
    <div style={{ flex: 1, minWidth: 140, background: 'white', padding: 16, borderRadius: 8, border: `1px solid ${color}22` }}>
      <div style={{ fontSize: 13, color: '#6b7280' }}>{titulo}</div>
      <div style={{ fontSize: 24, fontWeight: 'bold', color, marginTop: 4 }}>${valor.toFixed(0)}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <h2>Movimientos</h2>
      <p style={{ color: '#6b7280', marginTop: -4 }}>Elegí un día del calendario o el mes completo para ver el informe de ese período.</p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 340, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button onClick={() => moverMes(-1)} style={{ border: 'none', background: '#e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>‹</button>
            <strong>{MESES[mes]} {anio}</strong>
            <button onClick={() => moverMes(1)} style={{ border: 'none', background: '#e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
            {DIAS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {celdas.map((d, i) => {
              const activo = !!d && seleccion?.desde === iso(anio, mes, d) && seleccion?.hasta === iso(anio, mes, d);
              return (
                <button key={i} disabled={!d} onClick={() => d && elegirDia(d)}
                  style={{
                    padding: '8px 0', border: activo ? '1px solid #111827' : '1px solid transparent', borderRadius: 6,
                    background: activo ? '#111827' : (d === ahora.getDate() && mes === ahora.getMonth() && anio === ahora.getFullYear() ? '#ecfdf5' : 'transparent'),
                    color: activo ? 'white' : (d ? '#111827' : 'transparent'), fontWeight: activo ? 700 : 400, cursor: d ? 'pointer' : 'default', fontSize: 13,
                  }}>
                  {d || ''}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={elegirMes} style={{ flex: 1, padding: '8px 10px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Ver mes completo</button>
            <button onClick={() => { const d = ahora; setMes(d.getMonth()); setAnio(d.getFullYear()); elegirDia(d.getDate()); }} style={{ padding: '8px 12px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Hoy</button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 400 }}>
          {!seleccion && (
            <div style={{ background: 'white', padding: 40, borderRadius: 8, textAlign: 'center', color: '#9ca3af' }}>
              Seleccioná un día o el mes completo para ver los movimientos.
            </div>
          )}
          {seleccion && (
            <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Movimientos del {seleccion.etiqueta}</h3>
                <button onClick={() => { setSeleccion(null); setData(null); }} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
              </div>

              {cargando && <p style={{ color: '#6b7280' }}>Cargando...</p>}
              {!cargando && !data && <p style={{ color: '#dc2626' }}>No se pudo cargar el informe.</p>}

              {!cargando && data && (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                    {cajaResumen('Ventas', data.totales.ventasTotal, '#059669', `${data.totales.ventasCantidad} venta(s)`)}
                    {cajaResumen('Compras', data.totales.comprasTotal, '#0284c7', `${data.totales.comprasCantidad} compra(s)`)}
                    {cajaResumen('Gastos', data.totales.gastosTotal, '#dc2626', `${data.totales.gastosCantidad} movimiento(s)`)}
                    {data.totales.mermasTotal > 0 && cajaResumen('Merma', data.totales.mermasTotal, '#b45309', `${data.totales.mermasCantidad} conteo(s) c/faltante`)}
                    {cajaResumen('Neto caja', data.neto, data.neto >= 0 ? '#111827' : '#dc2626', 'ventas − compras − gastos')}
                  </div>

                  <h4 style={{ margin: '24px 0 8px', color: '#9a3412' }}>1. Gastos (movimientos de caja que no son compra ni venta)</h4>
                  {data.gastos.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin gastos en el período.</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>Fecha</th><th style={th}>Hora</th><th style={th}>Tipo</th><th style={th}>Descripción</th><th style={th}>Sucursal</th><th style={{ ...th, textAlign: 'right' }}>Importe</th></tr></thead>
                      <tbody>
                        {data.gastos.map((g: any) => (
                          <tr key={g.id}><td style={td}>{fechaCorta(g.fecha)}</td><td style={td}>{horaCorta(g.fecha)}</td><td style={td}>{g.tipo}</td><td style={td}>{g.descripcion || '-'}</td><td style={td}>{g.sucursal || '-'}</td><td style={{ ...td, textAlign: 'right', fontWeight: 'bold', color: '#dc2626' }}>${Math.round(g.monto).toFixed(0)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <h4 style={{ margin: '24px 0 8px', color: '#0284c7' }}>2. Compras del período</h4>
                  {data.compras.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin compras en el período.</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>Fecha</th><th style={th}>Proveedor</th><th style={th}>Factura</th><th style={th}>Medio</th><th style={th}>Items</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                      <tbody>
                        {data.compras.map((c: any) => (
                          <tr key={c.id}><td style={td}>{fechaCorta(c.fecha)}</td><td style={td}>{c.proveedor}</td><td style={td}>{c.nroFactura || '-'}</td><td style={td}>{c.metodoPago}</td><td style={td}>{c.items}</td><td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>${Math.round(c.total).toFixed(0)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <h4 style={{ margin: '24px 0 8px', color: '#059669' }}>3. Ventas del período</h4>
                  {data.ventas.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin ventas en el período.</p> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>Fecha</th><th style={th}>Hora</th><th style={th}>Comprobante</th><th style={th}>Medio</th><th style={th}>Items</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                      <tbody>
                        {data.ventas.map((v: any) => (
                          <tr key={v.id}><td style={td}>{fechaCorta(v.fecha)}</td><td style={td}>{horaCorta(v.fecha)}</td><td style={td}>N° {v.nro}</td><td style={td}>{v.metodoPago}</td><td style={td}>{v.items}</td><td style={{ ...td, textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>${Math.round(v.total).toFixed(0)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 24 }}>
                    <div style={{ flex: 1, minWidth: 300 }}>
                      <h4 style={{ margin: '0 0 8px' }}>4. Productos más vendidos</h4>
                      {data.topProductos.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin ventas en el período.</p> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr><th style={th}>#</th><th style={th}>Producto</th><th style={{ ...th, textAlign: 'right' }}>Unidades</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                          <tbody>
                            {data.topProductos.map((p: any, i: number) => (
                              <tr key={p.productoId}><td style={td}>{i + 1}</td><td style={td}>{p.nombre}</td><td style={{ ...td, textAlign: 'right' }}>{p.unidades}</td><td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>${p.total.toFixed(0)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 300 }}>
                      <h4 style={{ margin: '0 0 8px' }}>5. Categorías más vendidas</h4>
                      {data.topCategorias.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin ventas en el período.</p> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr><th style={th}>#</th><th style={th}>Categoría</th><th style={{ ...th, textAlign: 'right' }}>Unidades</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                          <tbody>
                            {data.topCategorias.map((c: any, i: number) => (
                              <tr key={c.categoria}><td style={td}>{i + 1}</td><td style={td}>{c.categoria}</td><td style={{ ...td, textAlign: 'right' }}>{c.unidades}</td><td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>${c.total.toFixed(0)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {data.mermas && data.mermas.length > 0 && (
                    <>
                      <h4 style={{ margin: '24px 0 8px', color: '#b45309' }}>6. Mermas y ajustes de stock (conteos)</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={th}>Fecha</th><th style={th}>Hora</th><th style={th}>Producto</th><th style={th}>Tipo</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={{ ...th, textAlign: 'right' }}>Valor</th><th style={th}>Detalle</th></tr></thead>
                        <tbody>
                          {data.mermas.map((m: any) => (
                            <tr key={m.id}>
                              <td style={td}>{fechaCorta(m.fecha)}</td>
                              <td style={td}>{horaCorta(m.fecha)}</td>
                              <td style={td}>{m.producto}</td>
                              <td style={td}><span style={{ color: m.tipo === 'MERMA' ? '#b45309' : '#059669', fontWeight: 600 }}>{m.tipo === 'MERMA' ? 'Merma' : 'Ajuste'}</span></td>
                              <td style={{ ...td, textAlign: 'right' }}>{m.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {m.unidad === 'UNIDAD' ? 'u' : m.unidad.toLowerCase()}</td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', color: m.tipo === 'MERMA' ? '#b45309' : '#059669' }}>${Math.round(m.valor).toFixed(0)}</td>
                              <td style={td}>{m.descripcion || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <small style={{ display: 'block', marginTop: 16, color: '#9ca3af' }}>
                    Se muestran hasta 200 movimientos por listado; los totales siempre son del período completo.
                  </small>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
