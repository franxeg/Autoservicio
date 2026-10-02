import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

interface Item { productoId: string; nombre: string; cantidad: string; precioCosto: string; }

export default function Compras() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [nroFactura, setNroFactura] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProveedores = async () => { const { data } = await api.get('/proveedores'); setProveedores(data); };
  const fetchProductos = async (q: string) => {
    if (!q || q.length < 1) { setProductos([]); return; }
    const { data } = await api.get('/productos', { params: { search: q, limit: 5 } });
    setProductos(data.data || data);
  };
  // Live search as you type
  useEffect(() => {
    const t = setTimeout(() => fetchProductos(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);
  const fetchHistorial = async () => {
    const { data } = await api.get('/compras', { params: { sucursalId, limit: 10 } });
    setHistorial(data.data || data);
  };
  useEffect(() => { fetchProveedores(); fetchHistorial(); }, []);

  const addProducto = (p: any) => {
    if (items.find(i => i.productoId === p.id)) return;
    setItems([...items, { productoId: p.id, nombre: p.nombre, cantidad: '1', precioCosto: String(p.precioCosto) }]);
    setBusqueda(''); setProductos([]);
  };

  const handleCompra = async () => {
    setError(''); setSuccess('');
    if (items.length === 0) { setError('Agregá productos'); return; }
    try {
      const { data } = await api.post('/compras', {
        sucursalId,
        proveedorId: proveedorId || undefined,
        nroFactura: nroFactura || undefined,
        items: items.map(i => ({ productoId: i.productoId, cantidad: parseFloat(i.cantidad), precioCosto: parseFloat(i.precioCosto) })),
      });
      setSuccess(`Compra #${data.id.slice(0,6)} por $${Number(data.total).toFixed(2)} registrada. Stock actualizado.`);
      setItems([]); setNroFactura('');
      fetchHistorial();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const total = items.reduce((acc, i) => acc + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precioCosto) || 0), 0);

  return (
    <div>
      <h2>Compras</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      {success && <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 6, marginBottom: 10, color: '#065f46' }}>{success}</div>}

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Nueva compra</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label>Proveedor<select value={proveedorId} onChange={e => setProveedorId(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="">Sin asignar</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></label>
          <label>Nro Factura<input value={nroFactura} onChange={e => setNroFactura(e.target.value)} placeholder="F001-..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        </div>

        <label>Buscar producto (nombre o código)<input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Escribí para ver sugerencias..." style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        {productos.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 8 }}>
            {productos.map(p => (
              <div key={p.id} onClick={() => addProducto(p)} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.nombre} <code>{p.codigoBarras || ''}</code></span><span>${Number(p.precioCosto).toFixed(2)} <button style={{ marginLeft: 8, padding: '4px 8px', background: '#111827', color: 'white', border: 'none', borderRadius: 4 }}>Agregar</button></span>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Producto</th><th>Cant</th><th>Costo</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.productoId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td>{it.nombre}</td>
                  <td><input type="number" value={it.cantidad} onChange={e => { const copy = [...items]; copy[idx].cantidad = e.target.value; setItems(copy); }} style={{ width: 70, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /></td>
                  <td><input type="number" value={it.precioCosto} onChange={e => { const copy = [...items]; copy[idx].precioCosto = e.target.value; setItems(copy); }} style={{ width: 90, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /></td>
                  <td>${((parseFloat(it.cantidad) || 0) * (parseFloat(it.precioCosto) || 0)).toFixed(2)}</td>
                  <td><button onClick={() => setItems(items.filter(i => i.productoId !== it.productoId))} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <strong>Total: ${total.toFixed(2)}</strong>
            <button onClick={handleCompra} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Registrar Compra (aumenta stock)</button>
          </div>
        )}
      </div>

      <div style={{ background: 'white', padding: 16, borderRadius: 8 }}>
        <h4>Historial compras</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Total</th><th>Items</th></tr></thead>
          <tbody>
            {historial.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td>{new Date(c.fecha).toLocaleDateString()}</td><td>{c.proveedor?.nombre || 'Sin asignar'}</td><td>{c.nroFactura || '-'}</td><td>${Number(c.total).toFixed(2)}</td><td>{c.detalles?.length || 0}</td>
              </tr>
            ))}
            {historial.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin compras</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
