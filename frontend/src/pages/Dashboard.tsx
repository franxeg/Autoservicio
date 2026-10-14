import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { hoyISO, horaCorta, isoCorta, isoDia, isoMesCorto } from '../lib/fecha';

export default function Dashboard() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || undefined;
  const sucursalNombre = user?.sucursal?.nombre;
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalHoy, setModalHoy] = useState(false);
  const [modalMes, setModalMes] = useState(false);
  const [ventasHoyDet, setVentasHoyDet] = useState<any[]>([]);
  const [periodo, setPeriodo] = useState('mes');
  const [desglose, setDesglose] = useState<any>(null);

  useEffect(() => {
    api.get('/reportes/desglose', { params: { sucursalId, periodo } })
      .then(r => setDesglose(r.data))
      .catch(() => setDesglose(null));
  }, [periodo]);

  useEffect(() => {
    api.get('/reportes/dashboard', { params: { sucursalId } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openVentasHoy = async () => {
    const { data } = await api.get('/ventas', { params: { sucursalId, fecha: hoyISO(), limit: 50 } });
    setVentasHoyDet(data.data || []);
    setModalHoy(true);
  };

  if (loading) return <p>Cargando dashboard...</p>;
  if (!data) return <p>Error al cargar dashboard</p>;

  const maxVentas = Math.max(...data.ventasPorDia.map((d: any) => d.total), 1);
  const maxMes = Math.max(...(data.ventasMesPorDia || []).map((d: any) => d.total), 1);

  const cardStyle = (active: boolean): React.CSSProperties => ({
    background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer', transition: 'transform 0.1s, boxShadow 0.1s', border: active ? '1px solid #111827' : '1px solid transparent',
  });

  return (
    <div>
      <h1>Dashboard {sucursalNombre ? `- ${sucursalNombre}` : sucursalId ? '(Sucursal)' : '(Todas)'}</h1>
      <p style={{ color: '#6b7280' }}>Click en las tarjetas para ver detalles</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
        <div style={cardStyle(false)} onClick={openVentasHoy} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
          <small style={{ color: '#6b7280' }}>VENTAS HOY ⓘ</small>
          <p style={{ fontSize: 22, fontWeight: 'bold', margin: '4px 0' }}>${Number(data.ventasHoy.total).toFixed(0)}</p>
          <small>{data.ventasHoy.cantidad} ventas - Ver detalle →</small>
        </div>
        <div style={cardStyle(false)} onClick={() => setModalMes(true)} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
          <small style={{ color: '#6b7280' }}>VENTAS ESTE MES ⓘ</small>
          <p style={{ fontSize: 22, fontWeight: 'bold', margin: '4px 0' }}>${Number(data.ventasEsteMes.total).toFixed(0)}</p>
          <small>{data.ventasEsteMes.cantidad} ventas · Ticket ${Number(data.ventasEsteMes.ticketPromedio).toFixed(0)} →</small>
        </div>
        <div style={{ ...cardStyle(false), background: data.stockCriticoCount > 0 ? '#fef2f2' : 'white', border: data.stockCriticoCount > 0 ? '1px solid #fecaca' : '1px solid transparent' }} onClick={() => navigate('/stock')} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
          <small style={{ color: '#6b7280' }}>STOCK CRÍTICO</small>
          <p style={{ fontSize: 22, fontWeight: 'bold', margin: '4px 0', color: data.stockCriticoCount > 0 ? '#dc2626' : '#059669' }}>{data.stockCriticoCount} productos</p>
          <small>{data.stockCriticoCount > 0 ? 'Ver en Stock →' : 'Todo OK →'}</small>
        </div>
        <div style={{ ...cardStyle(false), background: data.cajaAbierta ? '#ecfdf5' : '#fef2f2' }} onClick={() => navigate('/caja')} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
          <small style={{ color: '#6b7280' }}>CAJA</small>
          <p style={{ fontSize: 22, fontWeight: 'bold', margin: '4px 0', color: data.cajaAbierta ? '#059669' : '#dc2626' }}>{data.cajaAbierta ? 'ABIERTA' : 'CERRADA'}</p>
          <small>{data.cajaAbierta ? `Inicial $${Number(data.cajaAbierta.montoInicial).toFixed(0)} →` : 'Abrir en Caja →'}</small>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 20 }}>
        <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
          <h3>Ventas últimos 7 días</h3>
          <div style={{ display: 'flex', alignItems: 'end', gap: 6, height: 120, marginTop: 12 }}>
            {data.ventasPorDia.map((d: any) => (
              <div key={d.fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', background: d.total > 0 ? '#111827' : '#e5e7eb', height: `${(d.total / maxVentas) * 100}px`, minHeight: d.total > 0 ? 8 : 4, borderRadius: 4 }} title={`${d.fecha}: $${d.total}`} />
                <small style={{ fontSize: 10 }}>{isoDia(d.fecha)}/{isoMesCorto(d.fecha)}</small>
                <small style={{ fontSize: 10, color: '#6b7280' }}>{d.total > 1000 ? `${Math.round(d.total / 1000)}k` : d.total}</small>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
          <h3>Top productos</h3>
          {data.topProductos.length === 0 ? <small style={{ color: '#9ca3af' }}>Sin ventas</small> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}><th>Producto</th><th>Cant</th><th>Total</th></tr></thead>
              <tbody>{data.topProductos.map((p: any) => <tr key={p.productoId} style={{ borderBottom: '1px solid #f3f4f6' }}><td>{p.nombre}</td><td>{p.cantidad}</td><td>${Number(p.total).toFixed(0)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>

      {/* Desglose de precios */}
      <div style={{ background: 'white', padding: 20, borderRadius: 8, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Desglose de precios vendidos</h3>
            <small style={{ color: '#6b7280' }}>En qué se convirtió el precio de cada producto: costo + utilidad por % de venta + utilidad por % de crecimiento</small>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ v: 'hoy', l: 'Hoy' }, { v: '7d', l: '7 días' }, { v: 'mes', l: 'Este mes' }].map(o => (
              <button key={o.v} onClick={() => setPeriodo(o.v)} style={{
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: periodo === o.v ? 'bold' : 'normal',
                border: periodo === o.v ? '2px solid #111827' : '1px solid #d1d5db',
                background: periodo === o.v ? '#111827' : 'white',
                color: periodo === o.v ? 'white' : '#111827',
              }}>{o.l}</button>
            ))}
          </div>
        </div>

        {!desglose ? <p style={{ color: '#9ca3af' }}>Cargando desglose...</p> : desglose.vendido === 0 ? (
          <p style={{ color: '#9ca3af', marginTop: 16 }}>Sin ventas en este período</p>
        ) : (
          <>
            <div style={{ marginTop: 14, fontSize: 14, color: '#6b7280' }}>
              {desglose.ventas} ventas · {desglose.lineas} renglones · {desglose.unidades} unidades
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Costo (lo que salió)', valor: desglose.costo, color: '#6b7280', bg: '#f9fafb' },
                { label: 'Utilidad % de venta', valor: desglose.aporteVenta, color: '#059669', bg: '#ecfdf5' },
                { label: 'Utilidad % de crecimiento', valor: desglose.aporteCrecimiento, color: '#0284c7', bg: '#f0f9ff' },
              ].map(c => (
                <div key={c.label} style={{ background: c.bg, padding: 12, borderRadius: 6 }}>
                  <small style={{ color: '#6b7280' }}>{c.label}</small>
                  <p style={{ fontSize: 20, fontWeight: 'bold', margin: '4px 0 0', color: c.color }}>
                    ${Number(c.valor).toFixed(0)}
                    <span style={{ fontSize: 12, fontWeight: 'normal', color: '#9ca3af' }}> · {desglose.vendido > 0 ? Math.round((c.valor / desglose.vendido) * 100) : 0}%</span>
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', marginTop: 12, background: '#e5e7eb' }}>
              {[
                { v: desglose.costo, c: '#6b7280' },
                { v: desglose.aporteVenta, c: '#059669' },
                { v: desglose.aporteCrecimiento, c: '#0284c7' },
              ].map((s, i) => s.v > 0 ? <div key={i} title={`$${Number(s.v).toFixed(0)}`} style={{ width: `${(s.v / desglose.vendido) * 100}%`, background: s.c }} /> : null)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 'bold', marginTop: 6 }}>Total vendido: ${Number(desglose.vendido).toFixed(0)}</div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '6px 4px' }}>Producto</th><th>Unid</th><th>Costo</th><th>% Venta</th><th>% Crec.</th><th>Total vendido</th>
              </tr></thead>
              <tbody>
                {desglose.porProducto.map((p: any) => (
                  <tr key={p.productoId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 4px' }}>{p.nombre}</td>
                    <td>{p.unidades}</td>
                    <td style={{ color: '#6b7280' }}>${Number(p.costo).toFixed(0)}</td>
                    <td style={{ color: '#059669', fontWeight: 'bold' }}>${Number(p.aporteVenta).toFixed(0)}</td>
                    <td style={{ color: '#0284c7', fontWeight: 'bold' }}>${Number(p.aporteCrecimiento).toFixed(0)}</td>
                    <td style={{ fontWeight: 'bold' }}>${Number(p.vendido).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Modal Ventas Hoy */}
      {modalHoy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setModalHoy(false)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 600, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3>Ventas de hoy ({ventasHoyDet.length})</h3><button onClick={() => setModalHoy(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button></div>
            {ventasHoyDet.length === 0 ? <p style={{ color: '#9ca3af' }}>Sin ventas hoy</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Hora</th><th>Total</th><th>Pago</th><th>Items</th></tr></thead>
                <tbody>
                  {ventasHoyDet.map((v: any) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}><td>{horaCorta(v.fecha)}</td><td>${Number(v.total).toFixed(0)}</td><td>{v.metodoPago}</td><td>{v.detalles?.length || 0}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ marginTop: 12, fontWeight: 'bold' }}>Total hoy: ${Number(data.ventasHoy.total).toFixed(0)}</p>
          </div>
        </div>
      )}

      {/* Modal Ventas Este Mes */}
      {modalMes && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setModalMes(false)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 700, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3>Ventas este mes - Resumen por día</h3><button onClick={() => setModalMes(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button></div>
            <p style={{ color: '#6b7280' }}>Total mes: ${Number(data.ventasEsteMes.total).toFixed(0)} ({data.ventasEsteMes.cantidad} ventas) · Ticket prom ${Number(data.ventasEsteMes.ticketPromedio).toFixed(0)}</p>
            <div style={{ display: 'flex', alignItems: 'end', gap: 3, height: 140, marginTop: 16, overflowX: 'auto' }}>
              {(data.ventasMesPorDia || []).map((d: any) => (
                <div key={d.fecha} style={{ flex: '1 0 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', background: d.total > 0 ? '#059669' : '#e5e7eb', height: `${(d.total / maxMes) * 100}px`, minHeight: d.total > 0 ? 6 : 3, borderRadius: 3 }} title={`${d.fecha}: $${d.total} (${d.cantidad})`} />
                  <small style={{ fontSize: 8 }}>{isoDia(d.fecha)}</small>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: 13 }}>
              <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Ventas</th><th>Total</th></tr></thead>
              <tbody>
                {(data.ventasMesPorDia || []).filter((d: any) => d.cantidad > 0).map((d: any) => (
                  <tr key={d.fecha} style={{ borderBottom: '1px solid #f3f4f6' }}><td>{isoCorta(d.fecha)}</td><td>{d.cantidad}</td><td>${Number(d.total).toFixed(0)}</td></tr>
                ))}
                {(data.ventasMesPorDia || []).filter((d: any) => d.cantidad > 0).length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 10, color: '#9ca3af' }}>Sin ventas este mes</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
