import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { calcularPrecioVenta } from '../lib/precio';

const redondear = (n: number) => Math.round(n * 1000) / 1000;
const reqInsumo = (cantidad: number, merma: number) => cantidad / (1 - Math.min(99.99, Math.max(0, merma || 0)) / 100);
const unidadTxt = (unidad?: string) => (unidad === 'KG' ? 'kg' : 'u.');

interface EditItem { insumoId: string; nombre: string; unidad?: string; precioCosto: number; cantidad: string; merma: string; }

export default function Elaborados({ sucursalId }: { sucursalId: string }) {
  const [elaborados, setElaborados] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', unidad: 'UNIDAD', porcentajeVenta: '30', porcentajeCrecimiento: '10' });
  const [showNuevo, setShowNuevo] = useState(false);

  const [edit, setEdit] = useState<any>(null);
  const [items, setItems] = useState<EditItem[]>([]);
  const [pctVenta, setPctVenta] = useState('30');
  const [pctCrec, setPctCrec] = useState('10');
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [producirCant, setProducirCant] = useState('1');
  const [msg, setMsg] = useState('');
  const [guardando, setGuardando] = useState(false);

  const fetchElaborados = async () => {
    try { const { data } = await api.get('/productos/elaborados', { params: { sucursalId } }); setElaborados(data); } catch {}
  };
  const fetchCatalogo = async () => {
    try { const { data } = await api.get('/productos', { params: { limit: 100, sucursalId, esElaborado: false } }); setCatalogo(data.data || data); } catch {}
  };
  useEffect(() => { fetchElaborados(); fetchCatalogo(); }, []);

  const abrir = async (e: any) => {
    setError(''); setMsg('');
    try {
      const { data } = await api.get(`/productos/${e.id}/receta`, { params: { sucursalId } });
      setItems((data.items || []).map((it: any) => ({
        insumoId: it.insumoId, nombre: it.nombre, unidad: it.unidad, precioCosto: it.precioCosto,
        cantidad: String(it.cantidad), merma: String(it.merma ?? 0),
      })));
      setPctVenta(String(data.producto?.porcentajeVenta ?? e.porcentajeVenta ?? 30));
      setPctCrec(String(data.producto?.porcentajeCrecimiento ?? e.porcentajeCrecimiento ?? 10));
      setProducirCant('1');
      setEdit(e);
      setBusqueda(''); setSugerencias([]);
    } catch (err: any) { setError(err.response?.data?.message || err.message); }
  };

  const crear = async () => {
    setError('');
    if (!nuevo.nombre.trim()) return;
    try {
      const { data } = await api.post('/productos', {
        nombre: nuevo.nombre.trim(),
        esElaborado: true,
        unidad: nuevo.unidad,
        porcentajeVenta: parseFloat(nuevo.porcentajeVenta) || 30,
        porcentajeCrecimiento: parseFloat(nuevo.porcentajeCrecimiento) || 10,
        sucursalId,
      });
      setShowNuevo(false);
      setNuevo({ nombre: '', unidad: 'UNIDAD', porcentajeVenta: '30', porcentajeCrecimiento: '10' });
      await fetchElaborados();
      await abrir(data);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const buscarInsumo = (v: string) => {
    setBusqueda(v);
    if (!v) { setSugerencias([]); return; }
    const enReceta = new Set(items.map(i => i.insumoId));
    setSugerencias(catalogo.filter(p => !enReceta.has(p.id) && (p.nombre.toLowerCase().includes(v.toLowerCase()) || (p.codigoBarras || '').includes(v))).slice(0, 6));
  };

  const addInsumo = (p: any) => {
    setItems(prev => [...prev, { insumoId: p.id, nombre: p.nombre, unidad: p.unidad, precioCosto: Number(p.precioCosto) || 0, cantidad: '1', merma: '0' }]);
    setBusqueda(''); setSugerencias([]);
  };
  const updItem = (idx: number, patch: Partial<EditItem>) => { const c = [...items]; c[idx] = { ...c[idx], ...patch }; setItems(c); };
  const delItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const costoPreview = items.reduce((acc, it) => acc + (Number(it.precioCosto) || 0) * reqInsumo(parseFloat(it.cantidad) || 0, parseFloat(it.merma) || 0), 0);
  const costoRedondeado = Math.round(costoPreview);
  const ventaPreview = calcularPrecioVenta(costoRedondeado, parseFloat(pctVenta) || 0, parseFloat(pctCrec) || 0);

  const guardar = async () => {
    if (!edit) return;
    setError(''); setMsg(''); setGuardando(true);
    try {
      await api.put(`/productos/${edit.id}/receta`, {
        items: items.map(it => ({ insumoId: it.insumoId, cantidad: redondear(parseFloat(it.cantidad) || 0), merma: parseFloat(it.merma) || 0 })),
      }, { params: { sucursalId } });
      setMsg('Receta guardada y precios recalculados');
      await fetchElaborados();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setGuardando(false); }
  };

  const producir = async () => {
    if (!edit) return;
    setError(''); setMsg('');
    const cant = parseFloat(producirCant) || 0;
    if (cant <= 0) { setError('Cantidad inválida'); return; }
    try {
      const { data } = await api.post(`/productos/${edit.id}/producir`, { sucursalId, cantidad: cant });
      setMsg(`Producción registrada: ${data.producido} ${unidadTxt(edit.unidad)}${data.stock != null ? `. Stock: ${data.stock}` : ''}`);
      await fetchElaborados();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const eliminar = async () => {
    if (!edit) return;
    if (!confirm(`¿Eliminar el elaborado ${edit.nombre}?`)) return;
    try { await api.delete(`/productos/${edit.id}`); setEdit(null); fetchElaborados(); } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: 10, borderRadius: 6, fontSize: 14, flex: 1, marginRight: 12 }}>
          Los elaborados pertenecen a la categoría <b>Elaborados</b> y no tienen costo propio: se calcula con los insumos de su receta. Si cambia el costo de un insumo (por compra o edición), el precio del elaborado se recalcula solo.
        </div>
        <button onClick={() => setShowNuevo(true)} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>+ Nuevo elaborado</button>
      </div>

      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse', marginTop: 16 }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
          <th style={{ padding: 10 }}>Elaborado</th><th>Insumos</th><th>Costo</th><th>Venta</th><th>Stock</th>
        </tr></thead>
        <tbody>
          {elaborados.map(e => (
            <tr key={e.id} onClick={() => abrir(e)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} title="Click para editar la receta">
              <td style={{ padding: 10 }}>{e.nombre}</td>
              <td><small style={{ color: '#6b7280' }}>{e.insumos.length} insumo{e.insumos.length === 1 ? '' : 's'}</small></td>
              <td>${Number(e.precioCosto).toFixed(0)}</td>
              <td style={{ fontWeight: 'bold' }}>${Number(e.precioVenta).toFixed(0)}</td>
              <td>{e.unidad === 'KG' ? '—' : e.stock}</td>
            </tr>
          ))}
          {elaborados.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Todavía no hay elaborados</td></tr>}
        </tbody>
      </table>

      {showNuevo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 55 }} onClick={() => setShowNuevo(false)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 460 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Nuevo elaborado</h3>
            <label style={{ display: 'block' }}>Nombre<input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej: Ensalada mixta" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} /></label>
            <label style={{ display: 'block', marginTop: 8 }}>Unidad<select value={nuevo.unidad} onChange={e => setNuevo({ ...nuevo, unidad: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}><option value="UNIDAD">Unidad</option><option value="KG">Peso</option></select></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <label>% Crecimiento<input type="number" min="0" step="any" value={nuevo.porcentajeCrecimiento} onChange={e => setNuevo({ ...nuevo, porcentajeCrecimiento: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} /></label>
              <label>% Venta<input type="number" min="0" step="any" value={nuevo.porcentajeVenta} onChange={e => setNuevo({ ...nuevo, porcentajeVenta: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} /></label>
            </div>
            <small style={{ color: '#6b7280' }}>Después cargás los insumos de la receta.</small>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={crear} style={{ flex: 1, padding: 10, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Crear y cargar receta</button>
              <button onClick={() => setShowNuevo(false)} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'start center', zIndex: 55, overflow: 'auto', padding: 24 }} onClick={() => setEdit(null)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 640, marginTop: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{edit.nombre}</h3>
              <button onClick={() => setEdit(null)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>

            <h4 style={{ marginBottom: 4 }}>Receta (insumos)</h4>
            <div style={{ position: 'relative' }}>
              <input value={busqueda} onChange={e => buscarInsumo(e.target.value)} placeholder="Buscar insumo para agregar..." style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              {sugerencias.length > 0 && (
                <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 5 }}>
                  {sugerencias.map(p => (
                    <div key={p.id} onMouseDown={() => addInsumo(p)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{p.nombre}</span><span style={{ color: '#6b7280' }}>${Number(p.precioCosto).toFixed(0)} / {unidadTxt(p.unidad)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left', fontSize: 13 }}><th style={{ padding: '6px 4px' }}>Insumo</th><th>Cant.</th><th>Merma %</th><th>Costo</th><th></th></tr></thead>
              <tbody>
                {items.map((it, idx) => {
                  const aporte = (Number(it.precioCosto) || 0) * reqInsumo(parseFloat(it.cantidad) || 0, parseFloat(it.merma) || 0);
                  return (
                    <tr key={it.insumoId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 4px' }}>{it.nombre} <small style={{ color: '#6b7280' }}>(${Number(it.precioCosto).toFixed(0)}/{unidadTxt(it.unidad)})</small></td>
                      <td><input type="number" min="0" step="any" value={it.cantidad} onChange={e => updItem(idx, { cantidad: e.target.value })} style={{ width: 72, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /> <small style={{ color: '#6b7280' }}>{unidadTxt(it.unidad)}</small></td>
                      <td><input type="number" min="0" step="any" value={it.merma} onChange={e => updItem(idx, { merma: e.target.value })} style={{ width: 60, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /></td>
                      <td>${Math.round(aporte).toFixed(0)}</td>
                      <td><button onClick={() => delItem(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 14, color: '#9ca3af' }}>Agregá insumos</td></tr>}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12, alignItems: 'end' }}>
              <label style={{ fontSize: 14 }}>Costo (calculado)<div style={{ fontWeight: 'bold', fontSize: 20, padding: '6px 0' }}>${costoRedondeado}</div></label>
              <label style={{ fontSize: 14 }}>% Crecimiento<div style={{ fontSize: 18, padding: '6px 0' }}>{pctCrec}%</div></label>
              <label style={{ fontSize: 14 }}>% Venta<div style={{ fontSize: 18, padding: '6px 0' }}>{pctVenta}%</div></label>
            </div>
            <small style={{ color: '#6b7280' }}>El % de crecimiento y venta quedan fijos desde el alta del elaborado.</small>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: '10px 12px', background: '#f3f4f6', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 14, color: '#374151' }}>Precio de venta (costo + %crecimiento + %venta)</span>
              <strong style={{ fontSize: 22 }}>${ventaPreview}</strong>
            </div>

            {msg && <div style={{ marginTop: 10, background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6 }}>{msg}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={guardar} disabled={guardando} style={{ flex: 1, padding: 10, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar receta'}</button>
              <button onClick={eliminar} style={{ padding: 10, background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Eliminar</button>
            </div>

            {edit.unidad === 'UNIDAD' && (
              <div style={{ marginTop: 16, borderTop: '1px dashed #e5e7eb', paddingTop: 14 }}>
                <h4 style={{ margin: '0 0 6px' }}>Producir</h4>
                <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: 14 }}>Al producir se suma el stock del elaborado. Los insumos por peso no descuentan stock.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" min="0" step="any" value={producirCant} onChange={e => setProducirCant(e.target.value)} style={{ width: 100, padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
                  <button onClick={producir} style={{ padding: '10px 16px', background: '#0f766e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Producir</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
