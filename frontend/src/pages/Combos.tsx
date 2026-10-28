import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const fmt = (n: number) => Math.round(Number(n) || 0);

interface Item {
  productoId: string;
  nombre: string;
  cantidad: string;
  precioUnitario: number;
}

export default function Combos({ sucursalId }: { sucursalId: string }) {
  const [combos, setCombos] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [nombre, setNombre] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [precioCombo, setPrecioCombo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const fetchCombos = async () => {
    try {
      const { data } = await api.get('/productos/combos', { params: { sucursalId } });
      setCombos(data || []);
    } catch {}
  };
  const fetchCatalogo = async () => {
    try {
      const all: any[] = [];
      let page = 1;
      const limit = 500;
      while (true) {
        const { data } = await api.get('/productos', { params: { limit, page, sucursalId } });
        const list = Array.isArray(data) ? data : (data.data || []);
        if (list.length === 0) break;
        all.push(...list);
        if (Array.isArray(data)) break;
        const total = data.total;
        if (total && all.length >= total) break;
        if (list.length < limit) break;
        page += 1;
        if (page > 50) break;
      }
      setCatalogo(all.filter((p: any) => !p.esElaborado));
    } catch {}
  };
  useEffect(() => { fetchCombos(); fetchCatalogo(); }, []);

  const abrirNuevo = () => {
    setError(''); setMsg('');
    setEdit(null);
    setNombre('');
    setItems([]);
    setBusqueda('');
    setSugerencias([]);
    setPrecioCombo('');
    setShow(true);
  };

  const abrirEditar = (c: any) => {
    setError(''); setMsg('');
    setEdit(c);
    setNombre(c.nombre);
    setItems((c.items || []).map((it: any) => ({ productoId: it.productoId, nombre: it.nombre, cantidad: String(it.cantidad || 1), precioUnitario: fmt(it.precioUnitario) })));
    setPrecioCombo(String(fmt(c.precioVenta)));
    setBusqueda('');
    setSugerencias([]);
    setShow(true);
  };

  const buscar = (v: string) => {
    setBusqueda(v);
    if (!v) { setSugerencias([]); return; }
    const en = new Set(items.map(i => i.productoId));
    setSugerencias(catalogo.filter(p => !en.has(p.id) && (p.nombre.toLowerCase().includes(v.toLowerCase()) || (p.codigoBarras || '').includes(v))).slice(0, 8));
  };

  const add = (p: any) => {
    setItems(prev => [...prev, { productoId: p.id, nombre: p.nombre, cantidad: '1', precioUnitario: fmt(p.precioVenta || 0) }]);
    setBusqueda(''); setSugerencias([]);
  };

  const upd = (idx: number, patch: Partial<Item>) => { const c = [...items]; c[idx] = { ...c[idx], ...patch }; setItems(c); };
  const del = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const totalLista = items.reduce((acc, it) => acc + fmt(it.precioUnitario) * (parseFloat(it.cantidad) || 0), 0);

  useEffect(() => {
    if (!edit) setPrecioCombo(String(fmt(totalLista)));
  }, [totalLista, edit]);

  const guardar = async () => {
    setError(''); setMsg('');
    if (!nombre.trim()) return setError('Poné un nombre para el combo');
    if (items.length === 0) return setError('Agregá al menos un producto');
    setGuardando(true);
    try {
      const bodyItems = items.map(it => ({ productoId: it.productoId, cantidad: parseFloat(it.cantidad) || 1 }));
      const precioVenta = precioCombo === '' ? fmt(totalLista) : fmt(parseFloat(precioCombo) || 0);
      if (edit) {
        await api.patch(`/productos/combos/${edit.id}`, { nombre: nombre.trim(), items: bodyItems, precioVenta });
        setMsg('Combo actualizado');
      } else {
        await api.post('/productos/combos', { nombre: nombre.trim(), items: bodyItems, precioVenta });
        setMsg('Combo creado');
      }
      await fetchCombos();
      setTimeout(() => { setShow(false); setMsg(''); }, 600);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (c: any) => {
    if (!confirm(`¿Eliminar el combo "${c.nombre}"?`)) return;
    try {
      await api.delete(`/productos/combos/${c.id}`);
      fetchCombos();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}
      {msg && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6, marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: 10, borderRadius: 6, fontSize: 14, flex: 1, marginRight: 12 }}>
          Si en el carrito del POS hay exactamente los productos y cantidades que forman un combo, se puede aplicar con el precio del combo. Al venderlo se descuentan stock de cada componente por separado.
        </div>
        <button onClick={abrirNuevo} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Nuevo combo</button>
      </div>

      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
          <th style={{ padding: 10 }}>Combo</th><th>Componentes</th><th>Total por separado</th><th>Precio combo</th><th>Ahorro</th><th></th>
        </tr></thead>
        <tbody>
          {combos.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: 10, fontWeight: 600 }}>{c.nombre}</td>
              <td><small style={{ color: '#6b7280' }}>{(c.items || []).map((it: any) => `${it.cantidad}x ${it.nombre}`).join(', ')}</small></td>
              <td>${fmt(c.totalLista)}</td>
              <td style={{ fontWeight: 'bold' }}>${fmt(c.precioVenta)}</td>
              <td>{c.ahorro > 0 ? <span style={{ color: '#059669' }}>-${fmt(c.ahorro)}</span> : '-'}</td>
              <td style={{ textAlign: 'right', paddingRight: 10 }}>
                <button onClick={() => abrirEditar(c)} style={{ marginRight: 6, padding: '6px 10px', border: '1px solid #d1d5db', background: 'white', borderRadius: 6, cursor: 'pointer' }}>Editar</button>
                <button onClick={() => eliminar(c)} style={{ padding: '6px 10px', border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, cursor: 'pointer' }}>Eliminar</button>
              </td>
            </tr>
          ))}
          {combos.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Todavía no hay combos</td></tr>}
        </tbody>
      </table>

      {show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'start center', zIndex: 55, overflow: 'auto', padding: 24 }} onClick={() => setShow(false)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 700, marginTop: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{edit ? 'Editar combo' : 'Nuevo combo'}</h3>
              <button onClick={() => setShow(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>

            <label style={{ display: 'block', marginTop: 12 }}>Nombre del combo<input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Combo 1" style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} /></label>

            <h4 style={{ margin: '16px 0 8px' }}>Productos que componen el combo</h4>
            <div style={{ position: 'relative' }}>
              <input value={busqueda} onChange={e => buscar(e.target.value)} placeholder="Buscar producto para agregar..." style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              {sugerencias.length > 0 && (
                <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 5, maxHeight: 260, overflow: 'auto' }}>
                  {sugerencias.map(p => (
                    <div key={p.id} onMouseDown={() => add(p)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{p.nombre}</span><span style={{ color: '#6b7280' }}>${fmt(p.precioVenta)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontSize: 13 }}><th style={{ padding: '6px 4px' }}>Producto</th><th>Cantidad</th><th>Precio lista</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.productoId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 4px' }}>{it.nombre}</td>
                    <td><input type="number" min="0.001" step="any" value={it.cantidad} onChange={e => upd(idx, { cantidad: e.target.value })} style={{ width: 80, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /></td>
                    <td>${fmt(it.precioUnitario)}</td>
                    <td>${fmt(it.precioUnitario) * (parseFloat(it.cantidad) || 0)}</td>
                    <td><button onClick={() => del(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 14, color: '#9ca3af' }}>Agregá productos al combo</td></tr>}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ color: '#6b7280', fontSize: 14 }}>Total por separado (suma)</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>${fmt(totalLista)}</div>
              </div>
              <div style={{ padding: '12px 14px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                <div style={{ color: '#065f46', fontSize: 14 }}>Precio del combo (editable)</div>
                <input type="number" min="0" step="1" value={precioCombo} onChange={e => setPrecioCombo(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #86efac', marginTop: 6, fontSize: 18, fontWeight: 700, boxSizing: 'border-box' }} />
                {totalLista > 0 && parseFloat(precioCombo || '0') < totalLista && (
                  <small style={{ color: '#047857' }}>Ahorro: ${fmt(totalLista - (parseFloat(precioCombo) || 0))}</small>
                )}
              </div>
            </div>

            {error && <div style={{ marginTop: 12, background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={guardar} disabled={guardando} style={{ flex: 1, padding: 12, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>{guardando ? 'Guardando...' : 'Guardar combo'}</button>
              <button onClick={() => setShow(false)} style={{ padding: '12px 18px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
