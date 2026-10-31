import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { calcularPrecioVenta } from '../lib/precio';
import Elaborados from './Elaborados';
import Combos from './Combos';

interface Producto {
  id: string;
  codigoBarras?: string;
  codigoInterno?: string;
  nombre: string;
  precioCosto: number;
  precioVenta: number;
  unidad?: string;
  esElaborado?: boolean;
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
  const [form, setForm] = useState({ codigoBarras: '', nombre: '', stockMinimo: '5', categoriaId: '', unidad: 'UNIDAD' });
  const [categorias, setCategorias] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ codigoBarras: '', nombre: '', precioCosto: '', porcentajeVenta: '', porcentajeCrecimiento: '', categoriaId: '', stock: '', stockMinimo: '', unidad: 'UNIDAD' });
  const [newCategoria, setNewCategoria] = useState('');
  const [showCatModal, setShowCatModal] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createPrecio, setCreatePrecio] = useState({ precioCosto: '', porcentajeCrecimiento: '10', porcentajeVenta: '30' });
  const [vista, setVista] = useState<'productos' | 'elaborados' | 'combos'>('productos');
  const [catFiltro, setCatFiltro] = useState<string>('ALL');
  const searchRef = useRef<HTMLInputElement>(null);
  const defaultCatSet = useRef(false);

  const fetchProductos = async (q?: string) => {
    setLoading(true);
    try {
      const all: Producto[] = [];
      let page = 1;
      const limit = 500;
      while (true) {
        const { data } = await api.get('/productos', { params: { search: q || undefined, limit, page, sucursalId } });
        const list = Array.isArray(data) ? data : (data.data || []);
        if (list.length === 0) break;
        all.push(...list);
        if (Array.isArray(data)) break;
        const total = data.total;
        if (total && all.length >= total) break;
        if (list.length < limit) break;
        page += 1;
        if (page > 100) break;
      }
      setProductos(all);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };
  const fetchCategorias = async () => {
    try {
      const { data } = await api.get('/categorias');
      setCategorias(data);
      // Mostrar todas las categorías por defecto
    } catch {}
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

  // Filtra la tabla: si hay búsqueda activa, mostramos solo las coincidencias (ignora la categoría).
  // Si no, mostramos solo la categoría seleccionada en el desplegable.
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      setFiltered(productos.filter(p => p.nombre.toLowerCase().includes(q) || (p.codigoBarras || '').includes(search.trim())));
      return;
    }
    if (catFiltro === 'ALL') setFiltered(productos);
    else if (catFiltro === '') setFiltered(productos.filter(p => !p.categoriaId));
    else setFiltered(productos.filter(p => p.categoriaId === catFiltro));
  }, [search, productos, catFiltro]);

  const sugerencias = search.trim()
    ? productos.filter(p => p.nombre.toLowerCase().includes(search.trim().toLowerCase()) || (p.codigoBarras || '').includes(search.trim())).slice(0, 6)
    : [];

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setShowSug(false); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!form.nombre.trim()) { setError('Poné un nombre al producto.'); return; }
    setCreatePrecio({ precioCosto: '', porcentajeCrecimiento: '10', porcentajeVenta: '30' });
    setShowCreate(true);
  };

  const precioVentaPreviewCreate = () => {
    const costo = Math.round(parseFloat(createPrecio.precioCosto) || 0);
    const v = isNaN(parseFloat(createPrecio.porcentajeVenta)) ? 30 : parseFloat(createPrecio.porcentajeVenta);
    const c = isNaN(parseFloat(createPrecio.porcentajeCrecimiento)) ? 10 : parseFloat(createPrecio.porcentajeCrecimiento);
    return calcularPrecioVenta(costo, v, c);
  };

  const confirmarCreate = async () => {
    setError('');
    try {
      await api.post('/productos', {
        codigoBarras: form.codigoBarras || undefined,
        nombre: form.nombre,
        unidad: form.unidad,
        precioCosto: Math.round(parseFloat(createPrecio.precioCosto) || 0),
        porcentajeCrecimiento: isNaN(parseFloat(createPrecio.porcentajeCrecimiento)) ? undefined : parseFloat(createPrecio.porcentajeCrecimiento),
        porcentajeVenta: isNaN(parseFloat(createPrecio.porcentajeVenta)) ? undefined : parseFloat(createPrecio.porcentajeVenta),
        stockMinimo: form.unidad === 'KG' ? undefined : Math.round(parseFloat(form.stockMinimo) || 5),
        categoriaId: form.categoriaId || undefined,
        sucursalId,
      });
      setForm({ codigoBarras: '', nombre: '', stockMinimo: '5', categoriaId: '', unidad: 'UNIDAD' });
      setShowCreate(false);
      fetchProductos(search);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const openEdit = async (p: Producto) => {
    const pintar = (data: any) => {
      const stock = data.stocks?.find((s: any) => s.sucursalId === sucursalId)?.cantidad ?? '';
      const minimo = data.stocks?.find((s: any) => s.sucursalId === sucursalId)?.stockMinimo ?? 5;
      setEditForm({
        codigoBarras: data.codigoBarras || '',
        nombre: data.nombre || '',
        precioCosto: String(Math.round(data.precioCosto || 0)),
        porcentajeVenta: String(data.porcentajeVenta ?? 30),
        porcentajeCrecimiento: String(data.porcentajeCrecimiento ?? 10),
        categoriaId: data.categoriaId || '',
        stock: String(stock),
        stockMinimo: String(minimo),
        unidad: data.unidad || 'UNIDAD',
      });
    };
    try {
      const { data } = await api.get(`/productos/${p.id}`);
      setEditing(data);
      pintar(data);
    } catch {
      setEditing(p);
      pintar(p);
    }
  };

  const precioVentaPreview = () => {
    const costo = Math.round(parseFloat(editForm.precioCosto) || 0);
    const v = isNaN(parseFloat(editForm.porcentajeVenta)) ? 30 : parseFloat(editForm.porcentajeVenta);
    const c = isNaN(parseFloat(editForm.porcentajeCrecimiento)) ? 10 : parseFloat(editForm.porcentajeCrecimiento);
    return calcularPrecioVenta(costo, v, c);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      if (editing.esElaborado) {
        await api.patch(`/productos/${editing.id}`, { nombre: editForm.nombre });
      } else {
        const pesable = editForm.unidad === 'KG';
        const parseCant = (v: string) => pesable ? Math.round((parseFloat(v) || 0) * 1000) / 1000 : Math.round(parseFloat(v) || 0);
        await api.patch(`/productos/${editing.id}`, {
          codigoBarras: editForm.codigoBarras || undefined,
          nombre: editForm.nombre,
          unidad: editForm.unidad,
          precioCosto: Math.round(parseFloat(editForm.precioCosto) || 0),
          porcentajeVenta: isNaN(parseFloat(editForm.porcentajeVenta)) ? undefined : parseFloat(editForm.porcentajeVenta),
          porcentajeCrecimiento: isNaN(parseFloat(editForm.porcentajeCrecimiento)) ? undefined : parseFloat(editForm.porcentajeCrecimiento),
          categoriaId: editForm.categoriaId || undefined,
        });
        if (editForm.unidad !== 'KG' && (editForm.stock !== '' || editForm.stockMinimo !== '')) {
          const actual = editing.stocks?.find((s: any) => s.sucursalId === sucursalId)?.cantidad ?? 0;
          await api.patch(`/productos/${editing.id}/stock`, {
            sucursalId,
            cantidad: editForm.stock !== '' ? parseCant(editForm.stock) : actual,
            stockMinimo: editForm.stockMinimo !== '' ? parseCant(editForm.stockMinimo) : 5,
          });
        }
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

  const tabs = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <button onClick={() => setVista('productos')} style={{ padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, border: vista === 'productos' ? '2px solid #111827' : '1px solid #d1d5db', background: vista === 'productos' ? '#111827' : 'white', color: vista === 'productos' ? 'white' : '#111827' }}>Productos</button>
      <button onClick={() => setVista('elaborados')} style={{ padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, border: vista === 'elaborados' ? '2px solid #111827' : '1px solid #d1d5db', background: vista === 'elaborados' ? '#111827' : 'white', color: vista === 'elaborados' ? 'white' : '#111827' }}>Elaborados</button>
      <button onClick={() => setVista('combos')} style={{ padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, border: vista === 'combos' ? '2px solid #111827' : '1px solid #d1d5db', background: vista === 'combos' ? '#111827' : 'white', color: vista === 'combos' ? 'white' : '#111827' }}>Ofertas y Combos</button>
    </div>
  );

  if (vista === 'elaborados') {
    return (
      <div>
        <h2>Productos</h2>
        {tabs}
        <Elaborados sucursalId={sucursalId} />
      </div>
    );
  }

  if (vista === 'combos') {
    return (
      <div>
        <h2>Productos</h2>
        {tabs}
        <Combos sucursalId={sucursalId} />
      </div>
    );
  }

  return (
    <div>
      <h2>Productos</h2>
      {tabs}
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input ref={searchRef} placeholder="Buscar por nombre o código... (muestra solo ese producto)" value={search} onChange={e => { setSearch(e.target.value); setShowSug(true); }} onFocus={() => search && setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 200)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          {showSug && sugerencias.length > 0 && (
            <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 5, maxHeight: 280, overflow: 'auto' }}>
              {sugerencias.map(p => (
                <div key={p.id} onMouseDown={() => { setSearch(p.nombre); setShowSug(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.nombre} {p.codigoBarras && <code style={{ fontSize: 11, color: '#6b7280' }}>{p.codigoBarras}</code>}</span>
                  <span style={{ color: '#6b7280' }}>${Number(p.precioVenta).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="submit" style={{ padding: '10px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Buscar</button>
        <button type="button" onClick={() => { setSearch(''); setCatFiltro('ALL'); fetchProductos(''); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpiar</button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, color: '#374151' }}>Ver categoría:</label>
        <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
          <option value="ALL">Todas las categorías</option>
          <option value="">Sin categoría</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.esSistema ? ' (sistema)' : ''}</option>)}
        </select>
        {search.trim()
          ? <small style={{ color: '#0ea5e9' }}>Mostrando la búsqueda "{search}" (ignora la categoría)</small>
          : <small style={{ color: '#6b7280' }}>{filtered.length} producto{filtered.length === 1 ? '' : 's'}</small>}
      </div>

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Alta rápida (con lector: código en Código barras)</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr 0.8fr 0.7fr auto', gap: 8, alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Código barras<input value={form.codigoBarras} onChange={e => setForm({ ...form, codigoBarras: e.target.value })} placeholder="779..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Nombre*<input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Categoría<div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><select value={form.categoriaId} onChange={e => setForm({ ...form, categoriaId: e.target.value })} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}><option value="">Sin categoría</option>{categorias.filter(c => !c.esSistema).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select><button type="button" onClick={() => setShowCatModal(true)} style={{ padding: '8px 10px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }} title="Gestionar categorías">＋</button></div></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Unidad<select value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}><option value="UNIDAD">Unidad</option><option value="KG">Peso</option></select></label>
          {form.unidad !== 'KG' && <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Mínimo stock<input type="number" min="0" step="any" value={form.stockMinimo} onChange={e => setForm({ ...form, stockMinimo: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>}
          <button type="submit" style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', height: 38, alignSelf: 'end' }}>Crear</button>
        </form>
      </div>

      {loading ? <p>Cargando...</p> : (
        <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Código</th><th>Nombre</th><th>Categoría</th><th>Costo</th><th>Venta</th><th>Stock</th></tr></thead>
          <tbody>
            {filtered.map(p => {
              const stock = p.unidad === 'KG' ? '—' : ((p as any).stocks?.[0]?.cantidad ?? '-');
              return (
                <tr key={p.id} onClick={() => openEdit(p)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} title="Click para editar">
                  <td style={{ padding: 10 }}><code>{p.codigoBarras || '-'}</code></td>
                  <td>{p.nombre}</td><td>{p.categoria?.nombre || '-'}</td>
                  <td>${Number(p.precioCosto).toFixed(0)}</td><td style={{ fontWeight: 'bold' }}>${Number(p.precioVenta).toFixed(0)}{p.unidad === 'KG' ? '/kg' : ''}</td>
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
            {editing.esElaborado ? (
              <div style={{ marginTop: 12, background: '#eff6ff', color: '#1d4ed8', padding: 12, borderRadius: 6, fontSize: 13 }}>
                Este es un <b>producto elaborado</b>. Su categoría es <b>Elaborados</b> y su costo y precio de venta salen de la receta.
                Se administra desde la pestaña <b>Elaborados</b> (receta, producción y ventas).
                <div style={{ marginTop: 8, color: '#111827' }}>Costo actual: <b>${Number(editing.precioCosto).toFixed(0)}</b> · Precio de venta: <b>${Number(editing.precioVenta).toFixed(0)}</b></div>
              </div>
            ) : (
              <>
                <label style={{ display: 'block', marginTop: 8 }}>Categoría<select value={editForm.categoriaId} onChange={e => setEditForm({ ...editForm, categoriaId: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}><option value="">Sin categoría</option>{categorias.filter(c => !c.esSistema).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
                <label style={{ display: 'block', marginTop: 8 }}>Unidad de venta<select value={editForm.unidad} onChange={e => setEditForm({ ...editForm, unidad: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}><option value="UNIDAD">Unidad</option><option value="KG">Peso</option></select></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                  <label>Costo<input type="number" min="0" step="1" value={editForm.precioCosto} onChange={e => setEditForm({ ...editForm, precioCosto: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                  <label>% Crec.<input type="number" min="0" step="1" value={editForm.porcentajeCrecimiento} onChange={e => setEditForm({ ...editForm, porcentajeCrecimiento: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                  <label>% Venta<input type="number" min="0" step="1" value={editForm.porcentajeVenta} onChange={e => setEditForm({ ...editForm, porcentajeVenta: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '10px 12px', background: '#f3f4f6', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 14, color: '#374151' }}>Precio de venta (costo + %crecimiento + %venta)</span>
                  <strong style={{ fontSize: 20 }}>${precioVentaPreview().toFixed(0)}</strong>
                </div>
                {editForm.unidad !== 'KG' && (
                  <>
                    <label style={{ display: 'block', marginTop: 8 }}>Stock ({sucursalId})<input type="number" step="any" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                    <label style={{ display: 'block', marginTop: 8 }}>Mínimo en stock<input type="number" min="0" step="any" value={editForm.stockMinimo} onChange={e => setEditForm({ ...editForm, stockMinimo: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                  </>
                )}
              </>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleUpdate} style={{ flex: 1, padding: 10, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
              <button onClick={handleDelete} style={{ padding: 10, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Precio del producto</h3>
              <button onClick={() => setShowCreate(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ marginTop: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 10, fontSize: 13, color: '#374151' }}>
              <div><b>{form.nombre || 'Sin nombre'}</b></div>
              <div style={{ color: '#6b7280', marginTop: 2 }}>
                {form.codigoBarras ? `Código ${form.codigoBarras} · ` : ''}{categorias.find(c => c.id === form.categoriaId)?.nombre || 'Sin categoría'} · {form.unidad === 'KG' ? 'Peso (kg)' : 'Unidad'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
              <label style={{ fontSize: 13 }}>Costo<input autoFocus type="number" min="0" step="1" value={createPrecio.precioCosto} onChange={e => setCreatePrecio({ ...createPrecio, precioCosto: e.target.value })} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} /></label>
              <label style={{ fontSize: 13 }}>% Crec.<input type="number" min="0" step="1" value={createPrecio.porcentajeCrecimiento} onChange={e => setCreatePrecio({ ...createPrecio, porcentajeCrecimiento: e.target.value })} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} /></label>
              <label style={{ fontSize: 13 }}>% Venta<input type="number" min="0" step="1" value={createPrecio.porcentajeVenta} onChange={e => setCreatePrecio({ ...createPrecio, porcentajeVenta: e.target.value })} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '10px 12px', background: '#f3f4f6', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 14, color: '#374151' }}>Precio de venta (costo + %crecimiento + %venta)</span>
              <strong style={{ fontSize: 20 }}>${precioVentaPreviewCreate().toFixed(0)}</strong>
            </div>
            {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 8, borderRadius: 6, marginTop: 10, fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={confirmarCreate} style={{ flex: 1, padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Crear producto</button>
              <button onClick={() => setShowCreate(false)} style={{ padding: 10, background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
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
                  <span>{c.nombre}{c.esSistema && <small style={{ color: '#6b7280' }}> (sistema)</small>}</span>
                  {!c.esSistema && <button onClick={() => handleDeleteCategoria(c.id)} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Eliminar</button>}
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
