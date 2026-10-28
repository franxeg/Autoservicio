import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

const fmt = (n: any, unidad?: string) => {
  const v = Number(n) || 0;
  if (unidad === 'KG') return v.toFixed(3).replace(/\.?0+$/, '');
  return String(Math.round(v));
};
const unidadTxt = (unidad?: string) => (unidad === 'KG' ? 'kg' : 'u.');

export default function Stock() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';
  const [all, setAll] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [conteo, setConteo] = useState<any>(null);
  const [conteoCantidad, setConteoCantidad] = useState('');
  const [conteoDesc, setConteoDesc] = useState('');
  const [conteoMsg, setConteoMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const fetch = async () => {
    try {
      let page = 1;
      const allProducts: any[] = [];
      while (true) {
        const { data } = await api.get('/productos', { params: { sucursalId, page, limit: 200 } });
        const pageItems = Array.isArray(data) ? data : (data.data || []);
        if (!pageItems.length) break;
        allProducts.push(...pageItems);
        if (Array.isArray(data) || allProducts.length >= Number(data.total || 0)) break;
        page += 1;
        if (page > 20) break;
      }
      const list = allProducts.filter((p: any) => p.unidad !== 'KG');
      setAll(list); setProductos(list);
    } catch (err) {
      setAll([]); setProductos([]);
      console.error('Error cargando stock:', err);
    }
  };
  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    if (!search) { setProductos(all); return; }
    const f = all.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.codigoBarras || '').includes(search));
    setProductos(f);
  }, [search, all]);

  const bajoStock = productos.filter(p => { const stock = p.stocks?.[0]; return stock && stock.cantidad <= stock.stockMinimo; });

  const abrirConteo = (p: any) => {
    const stock = p.stocks?.[0];
    setConteo(p);
    setConteoCantidad(String(stock?.cantidad ?? 0));
    setConteoDesc('');
    setConteoMsg('');
  };

  const guardarConteo = async () => {
    if (!conteo) return;
    const contada = parseFloat((conteoCantidad || '').replace(',', '.'));
    if (isNaN(contada) || contada < 0) return;
    try {
      const { data } = await api.post(`/productos/${conteo.id}/conteo`, {
        sucursalId,
        cantidadContada: contada,
        descripcion: conteoDesc || undefined,
      });
      const etiqueta = data.tipo === 'MERMA' ? 'Merma' : 'Ajuste';
      setConteo(null);
      setOkMsg(`Conteo registrado. ${etiqueta}: ${fmt(Math.abs(data.cantidad), conteo.unidad)} ${unidadTxt(conteo.unidad)} = $${data.valor}`);
      window.setTimeout(() => setOkMsg(''), 5000);
      fetch();
    } catch (e: any) {
      setConteoMsg(e.response?.data?.message || 'Error al guardar el conteo');
    }
  };

  return (
    <div>
      <h2>Stock</h2>
      {okMsg && (
        <div style={{ background: '#ecfdf5', color: '#065f46', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          ✅ {okMsg}
        </div>
      )}
      {bajoStock.length > 0 && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          ⚠️ {bajoStock.length} productos con stock crítico: {bajoStock.map(p => p.nombre).join(', ')}
        </div>
      )}
      <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>
        Botón <strong>Conteo</strong> en cada producto: cargás lo que contás físicamente y el sistema registra la diferencia como merma (con su costo).
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Buscar producto... (filtra la tabla)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
        <button onClick={() => { setSearch(''); setProductos(all); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpiar</button>
      </div>
      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Producto</th><th>Código</th><th>Stock</th><th>Mínimo</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {productos.map(p => {
            const stock = p.stocks?.[0];
            const cant = Number(stock?.cantidad ?? 0);
            const min = Number(stock?.stockMinimo ?? 5);
            const critico = cant <= min;
            const sinStock = cant <= 0;
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: critico ? (sinStock ? '#fef2f2' : '#fffbeb') : 'white' }}>
                <td style={{ padding: 10 }}>{p.nombre}</td>
                <td><code>{p.codigoBarras || '-'}</code></td>
                <td style={{ fontWeight: 'bold', color: sinStock ? '#dc2626' : critico ? '#d97706' : '#059669' }}>{fmt(cant, p.unidad)} {unidadTxt(p.unidad)}</td>
                <td>{fmt(min, p.unidad)}</td>
                <td>{sinStock ? '🔴 Sin stock' : critico ? '🟡 Bajo' : '🟢 OK'}</td>
                <td><button onClick={() => abrirConteo(p)} style={{ padding: '6px 12px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Conteo</button></td>
              </tr>
            );
          })}
          {productos.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin productos</td></tr>}
        </tbody>
      </table>

      {conteo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setConteo(null)}>
          <div style={{ background: 'white', padding: 20, borderRadius: 12, width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Conteo de stock</h3>
              <button onClick={() => setConteo(null)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ margin: '8px 0 0' }}>{conteo.nombre}</p>
            <div style={{ background: '#f3f4f6', borderRadius: 6, padding: 10, marginTop: 8, fontSize: 14 }}>
              Esperado en sistema: <strong>{fmt(conteo.stocks?.[0]?.cantidad ?? 0, conteo.unidad)} {unidadTxt(conteo.unidad)}</strong>
              <br />Costo: <strong>${Number(conteo.precioCosto || 0).toFixed(0)}</strong> por {unidadTxt(conteo.unidad)}
            </div>
            <label style={{ display: 'block', marginTop: 12, fontSize: 14 }}>Cantidad contada ({unidadTxt(conteo.unidad)})</label>
            <input type="number" step="any" value={conteoCantidad} onChange={e => setConteoCantidad(e.target.value)} autoFocus style={{ width: '100%', padding: 12, fontSize: 20, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <label style={{ display: 'block', marginTop: 10, fontSize: 14 }}>Nota (opcional)</label>
            <input value={conteoDesc} onChange={e => setConteoDesc(e.target.value)} placeholder="Ej: merma por vencimiento, rotura..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            {conteoMsg && <div style={{ marginTop: 10, background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6 }}>{conteoMsg}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={guardarConteo} style={{ flex: 1, padding: 10, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Guardar conteo</button>
              <button onClick={() => setConteo(null)} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
