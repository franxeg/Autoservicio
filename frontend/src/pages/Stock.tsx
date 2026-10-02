import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

export default function Stock() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';
  const [all, setAll] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const fetch = async () => {
    const { data } = await api.get('/productos', { params: { sucursalId, limit: 100 } });
    const list = data.data || data;
    setAll(list); setProductos(list);
  };
  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    if (!search) { setProductos(all); return; }
    const f = all.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.codigoBarras || '').includes(search));
    setProductos(f);
  }, [search, all]);

  const bajoStock = productos.filter(p => { const stock = p.stocks?.[0]; return stock && stock.cantidad <= stock.stockMinimo; });

  return (
    <div>
      <h2>Stock - {sucursalId}</h2>
      {bajoStock.length > 0 && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          ⚠️ {bajoStock.length} productos con stock crítico: {bajoStock.map(p => p.nombre).join(', ')}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Buscar producto... (filtra la tabla)" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
        <button onClick={() => { setSearch(''); setProductos(all); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpiar</button>
      </div>
      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Producto</th><th>Código</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead>
        <tbody>
          {productos.map(p => {
            const stock = p.stocks?.[0];
            const cant = stock?.cantidad ?? 0;
            const min = stock?.stockMinimo ?? 5;
            const critico = cant <= min;
            const sinStock = cant === 0;
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: critico ? (sinStock ? '#fef2f2' : '#fffbeb') : 'white' }}>
                <td style={{ padding: 10 }}>{p.nombre}</td>
                <td><code>{p.codigoBarras || '-'}</code></td>
                <td style={{ fontWeight: 'bold', color: sinStock ? '#dc2626' : critico ? '#d97706' : '#059669' }}>{cant}</td>
                <td>{min}</td>
                <td>{sinStock ? '🔴 Sin stock' : critico ? '🟡 Bajo' : '🟢 OK'}</td>
              </tr>
            );
          })}
          {productos.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin productos</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
