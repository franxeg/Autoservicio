import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { fechaCorta, fechaHora, horaCorta } from '../lib/fecha';

export default function Caja() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';
  const [caja, setCaja] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [historialLimit, setHistorialLimit] = useState(10);
  const [montoInicial, setMontoInicial] = useState('5000');
  const [montoInicialVirtual, setMontoInicialVirtual] = useState('0');
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteMedio, setAjusteMedio] = useState('EFECTIVO');
  const [ajusteMonto, setAjusteMonto] = useState('');
  const [ajusteDesc, setAjusteDesc] = useState('');
  const [ajusteError, setAjusteError] = useState('');
  const [ajusteOk, setAjusteOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetch = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/caja/abierta', { params: { sucursalId } });
      let detalle = data;
      if (data) {
        const det = await api.get(`/caja/${data.id}`);
        detalle = det.data;
      }
      setCaja(detalle);
      const hist = await api.get(`/caja/sucursal/${sucursalId}`, { params: { limit: historialLimit } });
      setHistorial(hist.data);
      // Prellenar el saldo inicial con lo que dejó el último cierre (editable)
      if (!data) {
        const cerradas = (hist.data || []).filter((c: any) => c.estado === 'CERRADA' && c.fechaCierre);
        if (cerradas.length) {
          const ultima = cerradas.reduce((a: any, b: any) => new Date(a.fechaCierre) > new Date(b.fechaCierre) ? a : b);
          setMontoInicial(String(Math.round(Number(ultima.montoFinal) || 0)));
          setMontoInicialVirtual(String(Math.round(Number(ultima.montoFinalVirtual) || 0)));
        } else {
          setMontoInicial('0');
          setMontoInicialVirtual('0');
        }
      }
    } catch (e: any) {
      setError(e.response?.data?.message || '');
      setCaja(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [historialLimit]);

  const abrir = async () => {
    setError(''); setSuccess('');
    const mi = Math.round(parseFloat(montoInicial) || 0);
    const mv = Math.round(parseFloat(montoInicialVirtual) || 0);
    if (!confirm(`¿Abrir caja?\n\nEfectivo inicial: $${mi}\nVirtual inicial: $${mv}`)) return;
    try {
      await api.post('/caja/abrir', { sucursalId, montoInicial: mi, montoInicialVirtual: mv });
      setSuccess('Caja abierta');
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const cerrar = async () => {
    if (!caja) return;
    setError(''); setSuccess('');
    if (!confirm(`¿Cerrar caja?\n\nEfectivo inicial: $${Number(caja.montoInicial).toFixed(0)}\nVirtual inicial: $${Number(caja.montoInicialVirtual || 0).toFixed(0)}\nVentas efectivo: $${Number(caja.totalVentasEfectivo || 0).toFixed(0)}\nVentas transferencia: $${Number(caja.totalVentasTransferencia || 0).toFixed(0)}\nVentas tarjeta: $${Number(caja.totalVentasTarjeta || 0).toFixed(0)}\nVentas cuenta corriente: $${Number(caja.totalVentasCuentaCorriente || 0).toFixed(0)}\nBalance efectivo: $${Number(caja.balance ?? 0).toFixed(0)}\nBalance virtual: $${Number(caja.balanceVirtual ?? 0).toFixed(0)}`)) return;
    try {
      await api.patch(`/caja/${caja.id}/cerrar`, {});
      setSuccess('Caja cerrada');
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const handleAjuste = async () => {
    if (!caja) return;
    setAjusteError(''); setAjusteOk('');
    const monto = parseFloat(ajusteMonto);
    if (isNaN(monto) || monto === 0) { setAjusteError('Ingresá un monto válido (distinto de 0)'); return; }
    try {
      await api.post(`/caja/${caja.id}/movimiento`, {
        tipo: 'AJUSTE',
        monto: Math.round(monto),
        descripcion: ajusteDesc.trim() || (monto > 0 ? 'Ajuste de caja (ingreso)' : 'Ajuste de caja (egreso)'),
        metodoPago: ajusteMedio,
      });
      setAjusteOk('Ajuste registrado correctamente');
      setAjusteMonto(''); setAjusteDesc('');
      fetch();
      setTimeout(() => { setAjusteOpen(false); setAjusteOk(''); }, 1200);
    } catch (e: any) { setAjusteError(e.response?.data?.message || e.message); }
  };

  const imprimirCaja = async (id: string) => {
    try {
      const { data } = await api.get(`/caja/${id}`);
      const win = window.open('', '_blank', 'width=500,height=700');
      if (!win) return;
      const nombreEmp = (function(){ try { const u = JSON.parse(localStorage.getItem('user') || 'null'); return u?.empresa?.nombre || localStorage.getItem('empresa_nombre') || 'Autoservicio'; } catch { return 'Autoservicio'; } })();
      const empleado = data.usuario?.nombre || '-';
      const inicialEf = Number(data.montoInicial || 0);
      const inicialVirt = Number(data.montoInicialVirtual || 0);
      const ventasEf = Number(data.totalVentasEfectivo || 0);
      const ventasTransf = Number(data.totalVentasTransferencia || 0);
      const ventasTarjeta = Number(data.totalVentasTarjeta || 0);
      const ventasCC = Number(data.totalVentasCuentaCorriente || 0);
      const gastos = Number(data.gastos || 0);
      const compras = Number(data.compras || 0);
      const finalVirt = Number(data.balanceVirtual ?? data.montoFinalVirtual ?? 0);
      const finalEf = Number(data.balance ?? data.montoFinal ?? 0);
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Caja ${data.id}</title><style>body{font-family:monospace;font-size:12px;margin:0;padding:10px}h2{text-align:center;margin:4px}p{margin:2px 0}.line{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.tot{font-weight:bold;font-size:13px}</style></head><body><h2>${nombreEmp}</h2><p style="text-align:center">Caja ${data.estado}</p><p style="text-align:center">${data.fechaApertura ? new Date(data.fechaApertura).toLocaleString() : ''} ${data.fechaCierre ? '→ ' + new Date(data.fechaCierre).toLocaleString() : ''}</p><div class="line"></div><div class="row"><span>Empleado</span><span>${empleado}</span></div><div class="line"></div><div class="row"><span>Inicial efectivo</span><span>$${inicialEf.toFixed(0)}</span></div><div class="row"><span>Inicial virtual</span><span>$${inicialVirt.toFixed(0)}</span></div><div class="line"></div><div class="row"><span>Ventas efectivo</span><span>$${ventasEf.toFixed(0)}</span></div><div class="row"><span>Ventas transferencia</span><span>$${ventasTransf.toFixed(0)}</span></div><div class="row"><span>Ventas tarjeta</span><span>$${ventasTarjeta.toFixed(0)}</span></div><div class="row"><span>Ventas cta. cte.</span><span>$${ventasCC.toFixed(0)}</span></div><div class="line"></div><div class="row"><span>Gastos</span><span>$${gastos.toFixed(0)}</span></div><div class="row"><span>Compras</span><span>$${compras.toFixed(0)}</span></div><div class="line"></div><div class="row tot"><span>Final efectivo</span><span>$${finalEf.toFixed(0)}</span></div><div class="row tot"><span>Final virtual</span><span>$${finalVirt.toFixed(0)}</span></div><div class="line"></div><p style="text-align:center">¡Gracias!</p><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);};</script></body></html>`);
      win.document.close();
    } catch (e: any) {
      alert('Error al cargar datos de la caja');
    }
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h2>Caja</h2>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6, marginBottom: 12 }}>{success}</div>}

      {!caja ? (
        <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
          <h3>No hay caja abierta</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label>Saldo inicial efectivo ($)<input type="number" min="0" step="1" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
            <label>Saldo inicial virtual - Mercado Pago ($)<input type="number" min="0" step="1" value={montoInicialVirtual} onChange={e => setMontoInicialVirtual(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          </div>
          <button onClick={abrir} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Abrir Caja</button>
        </div>
      ) : (
        <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
          <h3 style={{ color: caja.estado === 'ABIERTA' ? '#059669' : '#dc2626' }}>Caja {caja.estado}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}><small>Inicial efectivo</small><p style={{ fontSize: 18, fontWeight: 'bold' }}>${Number(caja.montoInicial).toFixed(0)}</p></div>
            <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 6 }}><small>Inicial virtual</small><p style={{ fontSize: 18, fontWeight: 'bold', color: '#0284c7' }}>${Number(caja.montoInicialVirtual || 0).toFixed(0)}</p></div>
            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}><small>Ventas ({caja.ventas?.length || 0})</small><p style={{ fontSize: 18, fontWeight: 'bold' }}>${Number(caja.totalVentas || 0).toFixed(0)}</p><small style={{ fontSize: 11, color: '#6b7280' }}>Ef: ${Number(caja.totalVentasEfectivo || 0).toFixed(0)} | Virt: ${Number(caja.totalVentasVirtual || 0).toFixed(0)}</small></div>
            <div style={{ background: '#111827', color: 'white', padding: 12, borderRadius: 6 }}><small>Balance</small><p style={{ fontSize: 16, fontWeight: 'bold' }}>Ef: ${Number(caja.balance ?? 0).toFixed(0)}</p><p style={{ fontSize: 14, color: '#7dd3fc' }}>Virt: ${Number(caja.balanceVirtual ?? 0).toFixed(0)}</p></div>
          </div>
          {caja.estado === 'ABIERTA' ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={cerrar} style={{ padding: '10px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cerrar Caja</button>
              <button onClick={() => { setAjusteOpen(true); setAjusteError(''); setAjusteOk(''); setAjusteMonto(''); setAjusteDesc(''); }} style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ajuste de caja</button>
            </div>
          ) : (
            <p style={{ marginTop: 12, color: '#6b7280' }}>Cerrada el {fechaHora(caja.fechaCierre)} - Final: ${caja.montoFinal ? Number(caja.montoFinal).toFixed(0) : '-'}</p>
          )}
          {caja.movimientos?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4>Movimientos</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Tipo</th><th>Monto</th><th>Descripción</th><th>Medio</th><th>Fecha</th></tr></thead>
                <tbody>
                  {caja.movimientos.map((m: any) => {
                    let medio = '-';
                    if (m.tipo === 'VENTA') {
                      medio = m.metodoPago || m.datos?.metodoPago || '-';
                    } else if (m.tipo === 'APERTURA' || m.tipo === 'CIERRE') {
                      medio = m.usuario?.nombre || m.empleado?.nombre || m.createdBy?.nombre || m.datos?.usuario || '-';
                    } else if (m.tipo === 'GASTO') {
                      medio = m.metodoPago || m.formaPago || m.datos?.metodoPago || '-';
                    }
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td>{m.tipo}</td>
                        <td style={{ color: m.tipo === 'VENTA' || m.tipo === 'APERTURA' ? '#059669' : '#dc2626' }}>${Number(m.monto).toFixed(0)}</td>
                        <td>{m.descripcion}</td>
                        <td>{medio}</td>
                        <td>{horaCorta(m.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ margin: 0 }}>Historial (últimas {historialLimit})</h4>
          <button onClick={() => setHistorialLimit(l => l + 10)} style={{ padding: '4px 10px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Ver más</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Estado</th><th>Inicial (Ef+Virt)</th><th>Final (Ef+Virt)</th><th>Ventas</th><th>Apertura</th><th>Cierre</th><th></th></tr></thead>
          <tbody>
            {historial.map((h: any) => (
              <tr key={h.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td>{h.estado}</td>
                <td>${(Number(h.montoInicial || 0) + Number(h.montoInicialVirtual || 0)).toFixed(0)}</td>
                <td>{h.montoFinal ? `$${(Number(h.montoFinal || 0) + Number(h.montoFinalVirtual || 0)).toFixed(0)}` : '-'}</td>
                <td>{h._count?.ventas ?? '-'}</td>
                <td>{fechaHora(h.fechaApertura)}</td>
                <td>{h.fechaCierre ? fechaHora(h.fechaCierre) : '-'}</td>
                <td><button onClick={() => imprimirCaja(h.id)} style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Imprimir</button></td>
              </tr>
            ))}
            {historial.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin historial</td></tr>}
          </tbody>
        </table>
      </div>

      {ajusteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setAjusteOpen(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Ajuste de caja</h3>
            <p style={{ color: '#6b7280', fontSize: 13 }}>Sumar o restar dinero de la caja (ingreso extra, cambio mal dado, etc.).</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Medio
                <select value={ajusteMedio} onChange={e => setAjusteMedio(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Monto (positivo = ingreso, negativo = egreso)
                <input type="number" step="1" value={ajusteMonto} onChange={e => setAjusteMonto(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Descripción (opcional)
                <input value={ajusteDesc} onChange={e => setAjusteDesc(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={handleAjuste} style={{ flex: 1, padding: 10, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Confirmar</button>
                <button onClick={() => setAjusteOpen(false)} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
              </div>
              {ajusteError && <div style={{ color: '#dc2626', fontSize: 13 }}>{ajusteError}</div>}
              {ajusteOk && <div style={{ color: '#059669', fontSize: 13 }}>{ajusteOk}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
