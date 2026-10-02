import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

export default function Caja() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';
  const [caja, setCaja] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [montoInicial, setMontoInicial] = useState('5000');
  const [montoInicialVirtual, setMontoInicialVirtual] = useState('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetch = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/caja/abierta', { params: { sucursalId } });
      setCaja(data);
      if (data) {
        const det = await api.get(`/caja/${data.id}`);
        setCaja(det.data);
      }
      const hist = await api.get(`/caja/sucursal/${sucursalId}`);
      setHistorial(hist.data);
    } catch (e: any) {
      setError(e.response?.data?.message || '');
      setCaja(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const abrir = async () => {
    setError(''); setSuccess('');
    try {
      await api.post('/caja/abrir', { sucursalId, montoInicial: parseFloat(montoInicial), montoInicialVirtual: parseFloat(montoInicialVirtual) || 0 });
      setSuccess('Caja abierta');
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const cerrar = async () => {
    if (!caja) return;
    try {
      await api.patch(`/caja/${caja.id}/cerrar`, {});
      setSuccess('Caja cerrada');
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h2>Caja - {sucursalId}</h2>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6, marginBottom: 12 }}>{success}</div>}

      {!caja ? (
        <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
          <h3>No hay caja abierta</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label>Saldo inicial efectivo ($)<input type="number" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
            <label>Saldo inicial virtual - Mercado Pago ($)<input type="number" value={montoInicialVirtual} onChange={e => setMontoInicialVirtual(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          </div>
          <button onClick={abrir} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Abrir Caja</button>
        </div>
      ) : (
        <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
          <h3 style={{ color: caja.estado === 'ABIERTA' ? '#059669' : '#dc2626' }}>Caja {caja.estado} - #{caja.id.slice(0,6)}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}><small>Inicial efectivo</small><p style={{ fontSize: 18, fontWeight: 'bold' }}>${Number(caja.montoInicial).toFixed(2)}</p></div>
            <div style={{ background: '#f0f9ff', padding: 12, borderRadius: 6 }}><small>Inicial virtual</small><p style={{ fontSize: 18, fontWeight: 'bold', color: '#0284c7' }}>${Number(caja.montoInicialVirtual || 0).toFixed(2)}</p></div>
            <div style={{ background: '#f9fafb', padding: 12, borderRadius: 6 }}><small>Ventas ({caja.ventas?.length || 0})</small><p style={{ fontSize: 18, fontWeight: 'bold' }}>${Number(caja.totalVentas || 0).toFixed(2)}</p><small style={{ fontSize: 11, color: '#6b7280' }}>Ef: ${Number(caja.totalVentasEfectivo || 0).toFixed(0)} | Virt: ${Number(caja.totalVentasVirtual || 0).toFixed(0)}</small></div>
            <div style={{ background: '#111827', color: 'white', padding: 12, borderRadius: 6 }}><small>Balance</small><p style={{ fontSize: 16, fontWeight: 'bold' }}>Ef: ${Number(caja.balance ?? 0).toFixed(2)}</p><p style={{ fontSize: 14, color: '#7dd3fc' }}>Virt: ${Number(caja.balanceVirtual ?? 0).toFixed(2)}</p></div>
          </div>
          {caja.estado === 'ABIERTA' ? (
            <button onClick={cerrar} style={{ marginTop: 16, padding: '10px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cerrar Caja</button>
          ) : (
            <p style={{ marginTop: 12, color: '#6b7280' }}>Cerrada el {new Date(caja.fechaCierre).toLocaleString()} - Final: ${caja.montoFinal ? Number(caja.montoFinal).toFixed(2) : '-'}</p>
          )}
          {caja.movimientos?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4>Movimientos</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Tipo</th><th>Monto</th><th>Descripción</th><th>Fecha</th></tr></thead>
                <tbody>
                  {caja.movimientos.map((m: any) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}><td>{m.tipo}</td><td style={{ color: m.tipo === 'VENTA' || m.tipo === 'APERTURA' ? '#059669' : '#dc2626' }}>${Number(m.monto).toFixed(2)}</td><td>{m.descripcion}</td><td>{new Date(m.createdAt).toLocaleTimeString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginTop: 20 }}>
        <h4>Historial (últimas 10)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Estado</th><th>Inicial</th><th>Final</th><th>Ventas</th><th>Apertura</th></tr></thead>
          <tbody>
            {historial.map((h: any) => (
              <tr key={h.id} style={{ borderBottom: '1px solid #f3f4f6' }}><td>{h.estado}</td><td>${Number(h.montoInicial).toFixed(2)}</td><td>{h.montoFinal ? `$${Number(h.montoFinal).toFixed(2)}` : '-'}</td><td>{h._count?.ventas ?? '-'}</td><td>{new Date(h.fechaApertura).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
