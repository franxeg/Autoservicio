import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Sucursales() {
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '' });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetch = async () => {
    const { data } = await api.get('/sucursales');
    setSucursales(data);
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    setCreando(true);
    try {
      await api.post('/sucursales', form);
      setSuccess(`Sucursal '${form.nombre}' creada`);
      setForm({ nombre: '', direccion: '', telefono: '' });
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setCreando(false); }
  };

  return (
    <div>
      <h2>Sucursales</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      {success && <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 6, marginBottom: 10, color: '#065f46' }}>{success}</div>}

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Nueva sucursal</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
          <input required placeholder="Nombre*" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <button type="submit" disabled={creando} style={{ padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: creando ? 0.7 : 1 }}>{creando ? 'Creando...' : 'Crear sucursal'}</button>
        </form>
        <small style={{ color: '#6b7280' }}>Cada sucursal tiene su propio stock y caja. Empleados y POS se asignan a una sucursal.</small>
      </div>

      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Nombre</th><th>Dirección</th><th>Teléfono</th><th>Empleados</th></tr></thead>
        <tbody>
          {sucursales.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10 }}>{s.nombre}</td><td>{s.direccion || '-'}</td><td>{s.telefono || '-'}</td><td>{s._count?.usuarios ?? 0}</td>
            </tr>
          ))}
          {sucursales.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin sucursales</td></tr>}
        </tbody>
      </table>
    </div>
  );
}