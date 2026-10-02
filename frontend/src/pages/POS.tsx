import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

interface Item {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export default function POS() {
  const [codigo, setCodigo] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [descuento, setDescuento] = useState('');
  const [cajaAbierta, setCajaAbierta] = useState<any>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [showSug, setShowSug] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';

  useEffect(() => {
    checkCaja();
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try { const { data } = await api.get('/productos', { params: { limit: 100, sucursalId } }); setCatalog(data.data || data); } catch {}
  };

  const checkCaja = async () => {
    try {
      const { data } = await api.get('/caja/abierta', { params: { sucursalId } });
      setCajaAbierta(data);
    } catch { setCajaAbierta(null); }
  };

  const filteredSug = codigo ? catalog.filter(p => p.nombre.toLowerCase().includes(codigo.toLowerCase()) || (p.codigoBarras || '').includes(codigo)).slice(0, 6) : [];

  const addProducto = (producto: any, code?: string) => {
    const c = code || producto.codigoBarras || producto.nombre;
    setItems((prev) => {
      const existing = prev.find((p) => p.id === producto.id);
      if (existing) return prev.map((p) => p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p);
      return [...prev, { id: producto.id, codigo: c, nombre: producto.nombre, precio: Number(producto.precioVenta), cantidad: 1 }];
    });
    setCodigo(''); setShowSug(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleScan = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && codigo.trim()) {
      const code = codigo.trim();
      // Primero buscar en catálogo local por código exacto o nombre
      const local = catalog.find(p => p.codigoBarras === code || p.nombre.toLowerCase() === code.toLowerCase());
      if (local) { addProducto(local, code); return; }
      // Si hay sugerencia única, usarla
      if (filteredSug.length === 1) { addProducto(filteredSug[0]); return; }
      // Fallback a API por código
      setError(''); setSuccess('');
      setLoading(true);
      try {
        const { data } = await api.get(`/productos/codigo/${code}`);
        addProducto(data, code);
      } catch (err: any) {
        if (err.response?.status === 404) setError(`Producto no encontrado: ${code}`);
        else if (err.response?.status === 401) setError('Sesión expirada');
        else setError(err.response?.data?.message || err.message);
      } finally { setLoading(false); }
    }
  };

  const updateCantidad = (codigo: string, delta: number) => {
    setItems(prev => prev.map(p => p.codigo === codigo ? { ...p, cantidad: Math.max(1, p.cantidad + delta) } : p));
  };
  const removeItem = (codigo: string) => setItems(prev => prev.filter(p => p.codigo !== codigo));

  const totalBruto = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const descNum = parseFloat(descuento) || 0;
  const total = Math.max(0, totalBruto - descNum);

  const searchClientes = async () => {
    if (!clienteSearch) return;
    const { data } = await api.get('/clientes', { params: { search: clienteSearch } });
    setClientes(data);
  };

  const handleCobrar = async () => {
    if (!cajaAbierta) { setError('No hay caja abierta. Abrí la caja primero en la sección Caja.'); return; }
    if (items.length === 0) return;
    if (metodoPago === 'CUENTA_CORRIENTE' && !clienteId) { setError('Seleccioná cliente para cuenta corriente'); return; }
    setCobrando(true); setError(''); setSuccess('');
    try {
      const { data } = await api.post('/ventas', {
        sucursalId,
        metodoPago,
        descuento: descNum,
        cajaId: cajaAbierta.id,
        clienteId: metodoPago === 'CUENTA_CORRIENTE' ? clienteId : undefined,
        items: items.map(i => ({ productoId: i.id, cantidad: i.cantidad, precioUnitario: i.precio })),
      });
      setSuccess(`Venta #${data.nroComprobante} por $${Number(data.total).toFixed(2)} registrada`);
      setItems([]); setDescuento(''); setCodigo('');
      setMetodoPago('EFECTIVO');
      setClienteId(''); setClienteSearch(''); setClientes([]);
      checkCaja();
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cobrar');
    } finally { setCobrando(false); }
  };

  // Atajo F12 para cobrar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'F12') { e.preventDefault(); handleCobrar(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, cajaAbierta, metodoPago, descuento, clienteId]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
      <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
        <h2>POS - Punto de Venta</h2>
        {!cajaAbierta ? (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 6, marginTop: 8 }}>
            ⚠️ No hay caja abierta para esta sucursal. <a href="/caja" style={{ color: '#dc2626', fontWeight: 'bold' }}>Abrir caja</a> para poder cobrar.
          </div>
        ) : (
          <small style={{ color: '#059669' }}>✓ Caja abierta #{cajaAbierta.id.slice(0,6)} - Inicial: ${Number(cajaAbierta.montoInicial).toFixed(2)}</small>
        )}
        <div style={{ position: 'relative' }}>
          <input ref={inputRef} autoFocus value={codigo} onChange={(e) => { setCodigo(e.target.value); setShowSug(true); }} onKeyDown={handleScan} onFocus={() => setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 200)}
            placeholder="Escaneá código o escribí nombre... (ej: Yerba o 7790000000011)" style={{ width: '100%', padding: 16, fontSize: 18, marginTop: 12, border: '2px solid #111827', borderRadius: 8, boxSizing: 'border-box' }} />
          {showSug && filteredSug.length > 0 && (
            <div style={{ position: 'absolute', top: 58, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 20 }}>
              {filteredSug.map(p => (
                <div key={p.id} onMouseDown={() => addProducto(p)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.nombre} <code style={{ fontSize: 11, color: '#6b7280' }}>{p.codigoBarras || ''}</code></span><span style={{ fontWeight: 'bold' }}>${Number(p.precioVenta).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {loading && <small style={{ color: '#2563eb' }}>Buscando...</small>}
        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 6, marginTop: 8 }}>{error}</div>}
        {success && <div style={{ background: '#ecfdf5', color: '#059669', padding: 10, borderRadius: 6, marginTop: 8 }}>{success}</div>}

        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Código</th><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.codigo} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td>{item.codigo}</td><td>{item.nombre}</td>
                <td><button onClick={() => updateCantidad(item.codigo, -1)} style={{ padding: '2px 6px' }}>-</button><span style={{ margin: '0 8px' }}>{item.cantidad}</span><button onClick={() => updateCantidad(item.codigo, 1)} style={{ padding: '2px 6px' }}>+</button></td>
                <td>${item.precio.toFixed(2)}</td><td>${(item.precio * item.cantidad).toFixed(2)}</td>
                <td><button onClick={() => removeItem(item.codigo)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin productos - Probá 7790000000011</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ background: 'white', padding: 20, borderRadius: 8, height: 'fit-content' }}>
        <h3>Resumen</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span>Subtotal</span><span>${totalBruto.toFixed(2)}</span></div>
        <label style={{ display: 'block', marginTop: 10 }}>Descuento $<input type="number" value={descuento} onChange={e => setDescuento(e.target.value)} style={{ width: 100, marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'block', marginTop: 10 }}>Pago <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={{ marginLeft: 8, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }}>
          <option value="EFECTIVO">EFECTIVO</option><option value="TARJETA">TARJETA</option><option value="TRANSFERENCIA">TRANSFERENCIA</option><option value="CUENTA_CORRIENTE">CUENTA CORRIENTE</option>
        </select></label>
        {metodoPago === 'CUENTA_CORRIENTE' && (
          <div style={{ marginTop: 10 }}>
            <input placeholder="Buscar cliente por nombre/DNI" value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchClientes())} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
            <button onClick={searchClientes} style={{ marginTop: 6, padding: '6px 10px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer', width: '100%' }}>Buscar cliente</button>
            {clientes.length > 0 && (
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ width: '100%', marginTop: 6, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
                <option value="">Seleccioná cliente</option>
                {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre} {c.dni ? `(${c.dni})` : ''} - Saldo ${Number(c.saldoCuenta).toFixed(2)}</option>)}
              </select>
            )}
          </div>
        )}
        <p style={{ fontSize: 36, fontWeight: 'bold', margin: '16px 0' }}>${total.toFixed(2)}</p>
        <button onClick={handleCobrar} disabled={items.length === 0 || cobrando || !cajaAbierta} style={{ width: '100%', padding: 14, background: !cajaAbierta ? '#9ca3af' : '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: cobrando ? 'wait' : 'pointer', opacity: cobrando ? 0.7 : 1 }}>
          {cobrando ? 'Cobrando...' : 'COBRAR (F12)'}
        </button>
        {!cajaAbierta && <small style={{ color: '#dc2626' }}>Abrí la caja para cobrar</small>}
        <button style={{ width: '100%', padding: 10, marginTop: 8, background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={() => { setItems([]); setError(''); setSuccess(''); setDescuento(''); setMetodoPago('EFECTIVO'); setClienteId(''); setClienteSearch(''); setClientes([]); }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
