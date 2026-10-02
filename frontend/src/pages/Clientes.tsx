import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Clientes() {
  const [all, setAll] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', email: '', direccion: '' });
  const [search, setSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [cuenta, setCuenta] = useState<any>(null);
  const [pagoMonto, setPagoMonto] = useState('');

  const fetch = async () => {
    const { data } = await api.get('/clientes');
    setAll(data); setList(data);
  };
  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    if (!search) { setList(all); setShowSug(false); return; }
    const f = all.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.dni || '').includes(search));
    setList(f);
    setShowSug(f.length > 0 && f.length !== all.length);
  }, [search, all]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/clientes', form);
      setForm({ nombre: '', dni: '', telefono: '', email: '', direccion: '' });
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const verCuenta = async (id: string) => {
    const { data } = await api.get(`/clientes/${id}/cuenta`);
    setCuenta(data); setSelected(data.cliente);
  };

  const handlePago = async () => {
    if (!selected) return;
    try {
      await api.post(`/clientes/${selected.id}/pago`, { monto: parseFloat(pagoMonto) });
      setPagoMonto(''); verCuenta(selected.id); fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      <h2>Clientes</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input placeholder="Buscar por nombre o DNI... (filtra la lista)" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => search && setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 200)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          {showSug && (
            <div style={{ position: 'absolute', top: 42, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
              {list.slice(0, 5).map(c => (
                <div key={c.id} onMouseDown={() => { setSearch(c.nombre); setShowSug(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.nombre} {c.dni ? `(${c.dni})` : ''}</span><span style={{ color: c.saldoCuenta > 0 ? '#dc2626' : '#059669' }}>${Number(c.saldoCuenta).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setSearch(''); setList(all); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpiar</button>
      </div>

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Alta cliente</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input required placeholder="Nombre*" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <button type="submit" style={{ padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Crear</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        <table style={{ background: 'white', borderRadius: 8, borderCollapse: 'collapse', height: 'fit-content' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Nombre</th><th>DNI</th><th>Saldo</th><th>Acción</th></tr></thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 10 }}>{c.nombre}</td><td>{c.dni || '-'}</td>
                <td style={{ color: c.saldoCuenta > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }}>${Number(c.saldoCuenta).toFixed(2)}</td>
                <td><button onClick={() => verCuenta(c.id)} style={{ padding: '6px 10px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ver</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin clientes</td></tr>}
          </tbody>
        </table>

        <div style={{ background: 'white', padding: 16, borderRadius: 8, height: 'fit-content' }}>
          {!selected ? <p style={{ color: '#9ca3af' }}>Seleccioná un cliente para ver cuenta corriente</p> : (
            <>
              <h4>{selected.nombre} - Saldo: <span style={{ color: '#dc2626' }}>${Number(selected.saldoCuenta).toFixed(2)}</span></h4>
              {cuenta && (
                <>
                  <div style={{ marginTop: 12 }}>
                    <h5>Registrar pago</h5>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" placeholder="Monto" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                      <button onClick={handlePago} style={{ padding: '8px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Pagar</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <h5>Ventas a cuenta ({cuenta.ventas?.length || 0})</h5>
                    {cuenta.ventas?.length === 0 ? <small>Sin ventas</small> : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
                        <tbody>
                          {cuenta.ventas.map((v: any) => (
                            <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}><td>{new Date(v.fecha).toLocaleDateString()}</td><td>${Number(v.total).toFixed(2)}</td><td>{v.estado}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
