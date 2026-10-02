import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Proveedores() {
  const [all, setAll] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ nombre: '', cuit: '', telefono: '', email: '', direccion: '' });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showSug, setShowSug] = useState(false);

  const fetch = async () => {
    const { data } = await api.get('/proveedores');
    setAll(data); setList(data);
  };
  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    if (!search) { setList(all); setShowSug(false); return; }
    const f = all.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.cuit || '').includes(search));
    setList(f);
    setShowSug(f.length > 0 && f.length !== all.length);
  }, [search, all]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/proveedores', form);
      setForm({ nombre: '', cuit: '', telefono: '', email: '', direccion: '' });
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      <h2>Proveedores</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input placeholder="Buscar... (filtra la lista)" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => search && setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 200)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          {showSug && (
            <div style={{ position: 'absolute', top: 42, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
              {list.slice(0, 5).map(p => (
                <div key={p.id} onMouseDown={() => { setSearch(p.nombre); setShowSug(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}>{p.nombre} {p.cuit ? `(${p.cuit})` : ''}</div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setSearch(''); setList(all); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpiar</button>
      </div>
      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Alta proveedor</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input required placeholder="Nombre*" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="CUIT" value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <button type="submit" style={{ padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Crear</button>
        </form>
      </div>
      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Nombre</th><th>CUIT</th><th>Tel</th><th>Email</th></tr></thead>
        <tbody>
          {list.map(p => <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}><td style={{ padding: 10 }}>{p.nombre}</td><td>{p.cuit || '-'}</td><td>{p.telefono || '-'}</td><td>{p.email || '-'}</td></tr>)}
          {list.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin proveedores</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
