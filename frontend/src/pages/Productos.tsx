import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

interface Producto {
  id: string;
  codigoBarras?: string;
  codigoInterno?: string;
  nombre: string;
  precioCosto: number;
  precioVenta: number;
  categoria?: { id: string; nombre: string };
  categoriaId?: string;
  stocks?: any[];
}

export default function Productos() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';
  const [productos, setProductos] = useState<Producto[]>([]);
  const [filtered, setFiltered] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const [form, setForm] = useState({ codigoBarras: '', nombre: '', precioCosto: '', precioVenta: '', categoriaId: '' });
  const [categorias, setCategorias] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ codigoBarras: '', nombre: '', precioCosto: '', precioVenta: '', categoriaId: '', stock: '' });
  const [newCategoria, setNewCategoria] = useState('');
  const [showCatModal, setShowCatModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchProductos = async (q?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/productos', { params: { search: q || undefined, limit: 100, sucursalId } });
      const list = data.data || data;
      setProductos(list);
      setFiltered(list);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };
  const fetchCategorias = async () => {
    try { const { data } = await api.get('/categorias'); setCategorias(data); } catch {}
  };
  const handleAddCategoria = async () => {
    if (!newCategoria.trim()) return;
    try {
      const { data } = await api.post('/categorias', { nombre: newCategoria.trim() });
      setCategorias([...categorias, data]);
      setForm({ ...form, categoriaId: data.id });
      setEditForm(f => ({ ...f, categoriaId: data.id }));
      setNewCategoria('');
    } catch (e: any) { setError(e.response?.data?.message || 'Error al crear categoría'); }
  };
  const handleDeleteCategoria = async (id: string) => {
    if (!confirm('¿Eliminar categoría? Los productos quedarán sin categoría.')) return;
    try {
      await api.delete(`/categorias/${id}`);
      setCategorias(categorias.filter(c => c.id !== id));
      if (form.categoriaId === id) setForm({ ...form, categoriaId: '' });
    } catch (e: any) { setError(e.response?.data?.message || 'Error al eliminar'); }
  };
  useEffect(() => { fetchProductos(); fetchCategorias(); }, []);

  // Filtra la tabla de abajo en vivo (sin dropdown arriba)
  useEffect(() => {
    if (!search) { setFiltered(productos); return; }
    const f = productos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.codigoBarras || '').includes(search));
    setFiltered(f);
  }, [search, productos]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchProductos(search); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/productos', {
        codigoBarras: form.codigoBarras || undefined,
        nombre: form.nombre,
        precioCosto: parseFloat(form.precioCosto),
        precioVenta: parseFloat(form.precioVenta),
        categoriaId: form.categoriaId || undefined,
      });
      setForm({ codigoBarras: '', nombre: '', precioCosto: '', precioVenta: '', categoriaId: '' });
      fetchProductos(search);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const openEdit = async (p: Producto) => {
    try {
      const { data } = await api.get(`/productos/${p.id}`);
      setEditing(data);
      const stock = data.stocks?.find((s: any) => s.sucursalId === sucursalId)?.cantidad ?? '';
      setEditForm({
        codigoBarras: data.codigoBarras || '',
        nombre: data.nombre || '',
        precioCosto: String(data.precioCosto || ''),
        precioVenta: String(data.precioVenta || ''),
        categoriaId: data.categoriaId || '',
        stock: String(stock),
      });
    } catch { setEditing(p); }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      await api.patch(`/productos/${editing.id}`, {
        codigoBarras: editForm.codigoBarras || undefined,
        nombre: editForm.nombre,
        precioCosto: parseFloat(editForm.precioCosto),
        precioVenta: parseFloat(editForm.precioVenta),
        categoriaId: editForm.categoriaId || undefined,
      });
      if (editForm.stock !== '') {
        await api.patch(`/productos/${editing.id}/stock`, { sucursalId, cantidad: parseFloat(editForm.stock) });
      }
      setEditing(null);
      fetchProductos(search);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`¿Eliminar ${editing.nombre}?`)) return;
    try {
      await api.delete(`/productos/${editing.id}`);
      setEditing(null);
      fetchProductos(search);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      <h2>Productos</h2>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input ref={searchRef} placeholder="Buscar por nombre o código... (filtra la tabla)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
        <button type="submit" style={{ padding: '10px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Buscar</button>
        <button type="button" onClick={() => { setSearch(''); fetchProductos(''); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpiar</button>
      </form>

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Alta rápida (con lector: código en Código barras)</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Código barras<input value={form.codigoBarras} onChange={e => setForm({ ...form, codigoBarras: e.target.value })} placeholder="779..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Nombre*<input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Categoría<div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><select value={form.categoriaId} onChange={e => setForm({ ...form, categoriaId: e.target.value })} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}><option value="">Sin categoría</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select><button type="button" onClick={() => setShowCatModal(true)} style={{ padding: '8px 10px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }} title="Gestionar categorías">＋</button></div></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Costo*<input required type="number" step="0.01" value={form.precioCosto} onChange={e => setForm({ ...form, precioCosto: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Venta*<input required type="number" step="0.01" value={form.precioVenta} onChange={e => setForm({ ...form, precioVenta: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          <button type="submit" style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', height: 38, alignSelf: 'end' }}>Crear</button>
        </form>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Código</th><th>Nombre</th><th>Categoría</th><th>Costo</th><th>Venta</th><th>Stock</th></tr></thead>
          <tbody>
            {filtered.map(p => {
              const stock = (p as any).stocks?.[0]?.cantidad ?? '-';
              return (
                <tr key={p.id} onClick={() => openEdit(p)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} title="Click para editar">
                  <td style={{ padding: 10 }}><code>{p.codigoBarras || '-'}</code></td>
                  <td>{p.nombre}</td><td>{p.categoria?.nombre || '-'}</td>
                  <td>${Number(p.precioCosto).toFixed(2)}</td><td style={{ fontWeight: 'bold' }}>${Number(p.precioVenta).toFixed(2)}</td>
                  <td>{stock}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin productos</td></tr>}
          </tbody>
        </table>
      )}
      <small style={{ color: '#6b7280' }}>Click en un producto para editar/eliminar en ventana flotante</small>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setEditing(null)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3>Editar producto</h3><button onClick={() => setEditing(null)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button></div>
            <label style={{ display: 'block', marginTop: 10 }}>Código barras<input value={editForm.codigoBarras} onChange={e => setEditForm({ ...editForm, codigoBarras: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'block', marginTop: 8 }}>Nombre<input value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
            <label style={{ display: 'block', marginTop: 8 }}>Categoría<select value={editForm.categoriaId} onChange={e => setEditForm({ ...editForm, categoriaId: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}><option value="">Sin categoría</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <label>Costo<input type="number" value={editForm.precioCosto} onChange={e => setEditForm({ ...editForm, precioCosto: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
              <label>Venta<input type="number" value={editForm.precioVenta} onChange={e => setEditForm({ ...editForm, precioVenta: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
            </div>
            <label style={{ display: 'block', marginTop: 8 }}>Stock ({sucursalId})<input type="number" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleUpdate} style={{ flex: 1, padding: 10, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
              <button onClick={handleDelete} style={{ padding: 10, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {showCatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={() => setShowCatModal(false)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3>Gestionar categorías</h3><button onClick={() => setShowCatModal(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input placeholder="Nueva categoría..." value={newCategoria} onChange={e => setNewCategoria(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategoria()} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
              <button onClick={handleAddCategoria} style={{ padding: '8px 14px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Agregar</button>
            </div>
            <div style={{ marginTop: 16, maxHeight: 260, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              {categorias.length === 0 ? <p style={{ padding: 12, color: '#9ca3af', textAlign: 'center' }}>Sin categorías</p> : categorias.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                  <span>{c.nombre}</span>
                  <button onClick={() => handleDeleteCategoria(c.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
                </div>
              ))}
            </div>
            <small style={{ color: '#6b7280', display: 'block', marginTop: 8 }}>Al eliminar, los productos quedarán sin categoría.</small>
          </div>
        </div>
      )}
    </div>
  );
}
