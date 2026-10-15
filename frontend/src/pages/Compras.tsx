import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { fechaCorta, fechaHora } from '../lib/fecha';

interface Item { productoId: string; nombre: string; cantidad: string; precioCosto: string; porcentajeVenta: string; porcentajeCrecimiento: string; unidad?: string; }

const redondearCant = (n: number) => Math.round(n * 1000) / 1000;
const esPesable = (unidad?: string) => unidad === 'KG';

const STORAGE_KEY = 'compra_borrador_local';

const vaciar = () => ({
  items: [] as Item[],
  proveedorId: '',
  nroFactura: '',
  metodoPago: 'EFECTIVO',
});

export default function Compras() {
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [borradores, setBorradores] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cajaAbierta, setCajaAbierta] = useState<any>(null);

  // Gastos (movimientos de caja que no son compra de mercadería)
  const [gastoDesc, setGastoDesc] = useState('');
  const [gastoImporte, setGastoImporte] = useState('');
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [gastosCaja, setGastosCaja] = useState<any[]>([]);
  const [errorGasto, setErrorGasto] = useState('');
  const [gastoMetodo, setGastoMetodo] = useState('EFECTIVO');
  const [verGastos, setVerGastos] = useState(false);

  // Borrador en edición (id si viene de la lista de borradores del servidor)
  const inicial = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...vaciar(), ...JSON.parse(raw) };
    } catch {}
    return vaciar();
  })();

  const [items, setItems] = useState<Item[]>(inicial.items);
  const [proveedorId, setProveedorId] = useState(inicial.proveedorId);
  const [nroFactura, setNroFactura] = useState(inicial.nroFactura);
  const [metodoPago, setMetodoPago] = useState(inicial.metodoPago);
  const [editandoBorradorId, setEditandoBorradorId] = useState<string | null>(inicial.editandoBorradorId || null);

  // Ticket de confirmación: null = cerrado
  const [ticket, setTicket] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  const [verHistorialCompleto, setVerHistorialCompleto] = useState(false);
  const [historialTotal, setHistorialTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histCompleto, setHistCompleto] = useState<any[]>([]);
  const [histCompletoTotal, setHistCompletoTotal] = useState(0);
  const [histCompletoPage, setHistCompletoPage] = useState(1);
  const [histCompletoPages, setHistCompletoPages] = useState(1);
  const HIST_PAGE_SIZE = 10;
  const HIST_MODAL_SIZE = 20;

  const METODOS = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'TRANSFERENCIA', label: 'Transferencia' },
    { value: 'TARJETA', label: 'Tarjeta' },
    { value: 'CUENTA_CORRIENTE', label: 'Cuenta corriente' },
  ];
  const labelMetodo = (m: string) => METODOS.find(x => x.value === m)?.label || m;

  // Autosave del borrador local: cada cambio se persiste
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, proveedorId, nroFactura, metodoPago, editandoBorradorId }));
  }, [items, proveedorId, nroFactura, metodoPago, editandoBorradorId]);

  const fetchProveedores = async () => { const { data } = await api.get('/proveedores'); setProveedores(data); };
  const fetchProductos = async (q: string) => {
    if (!q || q.length < 1) { setProductos([]); return; }
    const { data } = await api.get('/productos', { params: { search: q, limit: 5 } });
    // No se pueden comprar elaborados: se cargan con "Elaborar" en la sección Elaborados
    setProductos((data.data || data).filter((p: any) => !p.esElaborado));
  };
  useEffect(() => {
    const t = setTimeout(() => fetchProductos(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const fetchBorradores = async () => {
    const { data } = await api.get('/compras', { params: { sucursalId, estado: 'BORRADOR', limit: 100 } });
    setBorradores(data.data || data);
  };

  // Historial paginado (solo confirmadas), siempre ordenado por fecha desc: las más recientes primero
  const fetchHistorial = async (page = 1) => {
    const { data } = await api.get('/compras', { params: { sucursalId, estado: 'CONFIRMADA', limit: HIST_PAGE_SIZE, page } });
    setHistorial(data.data || data);
    setHistorialTotal(data.total ?? (data.data || data).length);
    setHistPage(page);
  };

  const abrirHistorialCompleto = async (page = 1) => {
    const { data } = await api.get('/compras', { params: { sucursalId, estado: 'CONFIRMADA', limit: HIST_MODAL_SIZE, page } });
    setHistCompleto(data.data || data);
    setHistCompletoTotal(data.total ?? 0);
    setHistCompletoPages(data.totalPages ?? 1);
    setHistCompletoPage(page);
    setVerHistorialCompleto(true);
  };

  const refrescarHistorial = () => {
    fetchBorradores();
    fetchHistorial(1);
    if (verHistorialCompleto) abrirHistorialCompleto(1);
  };
  useEffect(() => { fetchProveedores(); fetchBorradores(); fetchHistorial(1); }, []);

  // La caja abierta se consulta siempre: la necesita la compra y también el registro de gastos
  useEffect(() => {
    api.get('/caja/abierta', { params: { sucursalId } })
      .then(r => setCajaAbierta(r.data))
      .catch(() => setCajaAbierta(null));
  }, [sucursalId]);

  const fetchGastosCaja = async (cajaId: string) => {
    try {
      const { data } = await api.get(`/caja/${cajaId}`);
      setGastosCaja((data.movimientos || []).filter((m: any) => ['GASTO', 'RETIRO'].includes(m.tipo)));
    } catch { setGastosCaja([]); }
  };
  useEffect(() => { if (cajaAbierta?.id) fetchGastosCaja(cajaAbierta.id); else setGastosCaja([]); }, [cajaAbierta?.id]);

  const registrarGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorGasto('');
    const importe = Math.round(parseFloat(gastoImporte) || 0);
    if (!gastoDesc.trim()) { setErrorGasto('Poné una descripción del gasto.'); return; }
    if (importe <= 0) { setErrorGasto('El importe debe ser mayor a cero.'); return; }
    if (!cajaAbierta) { setErrorGasto('No hay caja abierta en esta sucursal. Abrí la caja para registrar el gasto.'); return; }
    setGuardandoGasto(true);
    try {
      await api.post(`/caja/${cajaAbierta.id}/movimiento`, { tipo: 'GASTO', monto: importe, descripcion: gastoDesc.trim(), metodoPago: gastoMetodo });
      setGastoDesc(''); setGastoImporte('');
      await fetchGastosCaja(cajaAbierta.id);
    } catch (err: any) { setErrorGasto(err.response?.data?.message || err.message); }
    finally { setGuardandoGasto(false); }
  };

  const addProducto = (p: any) => {
    if (items.find(i => i.productoId === p.id)) return;
    setItems([...items, {
      productoId: p.id,
      nombre: p.nombre,
      cantidad: esPesable(p.unidad) ? '' : '1',
      precioCosto: String(p.precioCosto),
      porcentajeVenta: String(p.porcentajeVenta ?? 30),
      porcentajeCrecimiento: String(p.porcentajeCrecimiento ?? 10),
      unidad: p.unidad,
    }]);
    setBusqueda(''); setProductos([]);
  };

  const calcPrecioVenta = (costo: number, pctCrec: number, pctVenta: number) =>
    Math.round(costo * (1 + pctCrec / 100) * (1 + pctVenta / 100));

  const total = items.reduce((acc, i) => acc + Math.round(Math.round(parseFloat(i.precioCosto) || 0) * redondearCant(parseFloat(i.cantidad) || 0)), 0);

  const armarTicket = () => ({
    origen: 'nuevo',
    id: editandoBorradorId,
    fecha: new Date().toISOString(),
    estado: 'PENDIENTE',
    proveedor: proveedores.find(p => p.id === proveedorId) || null,
    nroFactura,
    metodoPago,
    total,
    detalles: items.map(i => ({
      cantidad: redondearCant(parseFloat(i.cantidad) || 0),
      precioCosto: Math.round(parseFloat(i.precioCosto) || 0),
      porcentajeVenta: parseFloat(i.porcentajeVenta) || 30,
      porcentajeCrecimiento: parseFloat(i.porcentajeCrecimiento) || 10,
      subtotal: Math.round(Math.round(parseFloat(i.precioCosto) || 0) * redondearCant(parseFloat(i.cantidad) || 0)),
      producto: { nombre: i.nombre },
    })),
  });

  // 1) Abrir el cuadro de confirmación (NO registra nada todavía)
  const abrirTicket = () => {
    setError('');
    if (items.length === 0) { setError('Agregá productos'); return; }
    if (metodoPago === 'CUENTA_CORRIENTE' && !proveedorId) { setError('Cuenta corriente: es obligatorio elegir proveedor'); return; }
    setTicket(armarTicket());
  };

  const payload = () => ({
    sucursalId,
    proveedorId: proveedorId || undefined,
    nroFactura: nroFactura || undefined,
    metodoPago,
    items: items.map(i => ({
      productoId: i.productoId,
      cantidad: redondearCant(parseFloat(i.cantidad) || 0),
      precioCosto: Math.round(parseFloat(i.precioCosto) || 0),
      porcentajeVenta: parseFloat(i.porcentajeVenta) || 30,
      porcentajeCrecimiento: parseFloat(i.porcentajeCrecimiento) || 10,
    })),
  });

  const reiniciar = () => {
    const v = vaciar();
    setItems(v.items); setProveedorId(v.proveedorId); setNroFactura(v.nroFactura); setMetodoPago(v.metodoPago);
    setEditandoBorradorId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const resolver = async (modo: 'confirmar' | 'borrador') => {
    setError(''); setGuardando(true);
    try {
      if (modo === 'borrador') {
        if (editandoBorradorId) {
          await api.patch(`/compras/${editandoBorradorId}`, { ...payload(), borrador: true });
          setSuccess('Borrador actualizado. Podés retomarlo desde la lista de borradores.');
        } else {
          await api.post('/compras', { ...payload(), borrador: true });
          setSuccess('Borrador guardado. Podés retomarlo desde la lista de borradores.');
        }
      } else {
        if (metodoPago !== 'CUENTA_CORRIENTE' && !cajaAbierta) {
          setError('No hay caja abierta en esta sucursal. Abrí la caja para confirmar la compra.'); setGuardando(false); return;
        }
        let compraId = editandoBorradorId;
        if (compraId) {
          await api.patch(`/compras/${compraId}`, { ...payload(), borrador: true });
        } else {
          // Se crea como borrador y recién se confirma abajo (create con borrador:false ya deja CONFIRMADA)
          const { data } = await api.post('/compras', { ...payload(), borrador: true });
          compraId = data.id;
        }
        if (compraId) await api.post(`/compras/${compraId}/confirmar`);
        const accion = metodoPago === 'CUENTA_CORRIENTE'
          ? 'dejada a cuenta corriente (deuda con el proveedor)'
          : 'y descontada de caja';
        setSuccess(`Compra por $${total.toFixed(0)} confirmada ${accion}. Stock actualizado.`);
      }
      reiniciar();
      setTicket(null);
      refrescarHistorial();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setGuardando(false); }
  };

  const eliminarBorrador = async (c: any) => {
    if (!confirm(`¿Eliminar el borrador de $${Number(c.total).toFixed(0)}?`)) return;
    try {
      await api.delete(`/compras/${c.id}`);
      if (editandoBorradorId === c.id) reiniciar();
      refrescarHistorial();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const cargarBorrador = (c: any) => {
    setItems(c.detalles.map((d: any) => ({
      productoId: d.productoId,
      nombre: d.producto?.nombre || d.productoId,
      cantidad: String(d.cantidad),
      precioCosto: String(d.precioCosto),
      porcentajeVenta: String(d.porcentajeVenta ?? 30),
      porcentajeCrecimiento: String(d.porcentajeCrecimiento ?? 10),
      unidad: d.producto?.unidad,
    })));
    setProveedorId(c.proveedorId || '');
    setNroFactura(c.nroFactura || '');
    setMetodoPago(c.metodoPago || 'EFECTIVO');
    setEditandoBorradorId(c.id);
    setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const verTicket = (c: any) => setTicket({ origen: 'servidor', ...c });

  const Imprimir = () => window.print();

  const filaHistorial = (c: any) => (
    <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '6px 8px' }}>{fechaCorta(c.fechaConfirmacion || c.fecha)}</td>
      <td style={{ padding: '6px 8px' }}>{c.proveedor?.nombre || 'Sin asignar'}</td>
      <td style={{ padding: '6px 8px' }}>{c.nroFactura || '-'}</td>
      <td style={{ padding: '6px 8px' }}>{labelMetodo(c.metodoPago || 'EFECTIVO')}</td>
      <td style={{ padding: '6px 8px' }}>${Number(c.total).toFixed(0)}</td>
      <td style={{ padding: '6px 8px' }}>{c.detalles?.length || 0}</td>
      <td style={{ padding: '6px 8px' }}><button onClick={() => verTicket(c)} style={{ padding: '4px 8px', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Ver ticket</button></td>
    </tr>
  );

  const th: any = { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb' };
  const td: any = { padding: '6px 8px', borderBottom: '1px solid #f3f4f6' };

  return (
    <div>
      <h2>Compras y gastos</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      {success && <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 6, marginBottom: 10, color: '#065f46' }}>{success}</div>}

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>{editandoBorradorId ? 'Editando borrador' : 'Nueva compra'}</h4>
          {editandoBorradorId && <button onClick={() => reiniciar()} style={{ padding: '6px 10px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar edición</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0' }}>
          <label>Proveedor<select value={proveedorId} onChange={e => setProveedorId(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="">Sin asignar</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></label>
          <label>Nro Factura<input value={nroFactura} onChange={e => setNroFactura(e.target.value)} placeholder="F001-..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Medio de pago</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {METODOS.map(m => {
              const sel = metodoPago === m.value;
              return (
                <button key={m.value} type="button" onClick={() => setMetodoPago(m.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, border: sel ? '1px solid #059669' : '1px solid #d1d5db', background: sel ? '#ecfdf5' : 'white', color: sel ? '#059669' : '#374151', fontWeight: sel ? 600 : 400 }}>
                  {sel ? '✓ ' : ''}{m.label}
                </button>
              );
            })}
          </div>
          {metodoPago === 'CUENTA_CORRIENTE' && (
            <small style={{ display: 'block', marginTop: 6, color: '#b45309' }}>
              Se registra la deuda con el proveedor. No descuenta de caja. {proveedorId ? '' : 'Elegí un proveedor arriba.'}
            </small>
          )}
          {metodoPago !== 'CUENTA_CORRIENTE' && !cajaAbierta && (
            <small style={{ display: 'block', marginTop: 6, color: '#dc2626' }}>No hay caja abierta en esta sucursal. Abrí la caja para confirmar la compra.</small>
          )}
        </div>

        <label>Buscar producto (nombre o código)<input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && productos.length > 0) {
              e.preventDefault();
              addProducto(productos[0]);
            }
          }}
          placeholder="Escribí para ver sugerencias..." style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        {productos.length > 0 && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 8 }}>
            {productos.map(p => (
              <div key={p.id} onClick={() => addProducto(p)} style={{ padding: 10, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.nombre} <code>{p.codigoBarras || ''}</code></span><span>${Number(p.precioCosto).toFixed(0)} <button style={{ marginLeft: 8, padding: '4px 8px', background: '#111827', color: 'white', border: 'none', borderRadius: 4 }}>Agregar</button></span>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th>Producto</th><th>Cant</th><th>Costo</th><th>Crecimiento</th><th>% de venta</th><th>Precio de venta</th><th>Subtotal</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((it, idx) => {
                const costo = parseFloat(it.precioCosto) || 0;
                const pctVenta = parseFloat(it.porcentajeVenta) || 0;
                const pctCrec = parseFloat(it.porcentajeCrecimiento) || 0;
                const precioVenta = calcPrecioVenta(costo, pctCrec, pctVenta);
                const subtotal = redondearCant(parseFloat(it.cantidad) || 0) * costo;
                const upd = (patch: Partial<Item>) => { const copy = [...items]; copy[idx] = { ...copy[idx], ...patch }; setItems(copy); };
                return (
                  <tr key={it.productoId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 4px' }}>{it.nombre}{esPesable(it.unidad) && <small style={{ color: '#6b7280' }}> (kg)</small>}</td>
                    <td><input type="number" min="0" step={esPesable(it.unidad) ? 'any' : '1'} value={it.cantidad} onChange={e => upd({ cantidad: e.target.value })} placeholder={esPesable(it.unidad) ? '0.000' : ''} style={{ width: 72, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /></td>
                    <td><input type="number" min="0" step="1" value={it.precioCosto} onChange={e => upd({ precioCosto: e.target.value })} style={{ width: 90, padding: 6, borderRadius: 6, border: '1px solid #d1d5db' }} /></td>
                    <td style={{ position: 'relative' }}><input type="number" min="0" step="1" value={it.porcentajeCrecimiento} onChange={e => upd({ porcentajeCrecimiento: e.target.value })} style={{ width: 64, padding: '6px 18px 6px 6px', borderRadius: 6, border: '1px solid #d1d5db' }} /><span style={{ position: 'absolute', left: 46, top: 7, color: '#6b7280', fontSize: 12 }}>%</span></td>
                    <td style={{ position: 'relative' }}><input type="number" min="0" step="1" value={it.porcentajeVenta} onChange={e => upd({ porcentajeVenta: e.target.value })} style={{ width: 64, padding: '6px 18px 6px 6px', borderRadius: 6, border: '1px solid #d1d5db' }} /><span style={{ position: 'absolute', left: 46, top: 7, color: '#6b7280', fontSize: 12 }}>%</span></td>
                    <td style={{ fontWeight: 'bold', color: '#059669', whiteSpace: 'nowrap' }}>${precioVenta.toFixed(0)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>${subtotal.toFixed(0)}</td>
                    <td><button onClick={() => setItems(items.filter(i => i.productoId !== it.productoId))} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {items.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
            <strong>Total: ${total.toFixed(0)}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => resolver('borrador')} style={{ padding: '10px 16px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Guardar como borrador</button>
              <button onClick={abrirTicket} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Registrar Compra</button>
            </div>
          </div>
        )}
        <small style={{ color: '#6b7280', display: 'block', marginTop: 8 }}>La compra se guarda solo cuando la confirmás en el cuadro siguiente. El borrador se conserva aunque cambies de pantalla.</small>
      </div>

      {borradores.length > 0 && (
        <div style={{ background: '#fffbeb', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #fde68a' }}>
          <h4 style={{ marginTop: 0 }}>Borradores (pedidos pendientes)</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left' }}><th style={th}>Fecha</th><th style={th}>Proveedor</th><th style={th}>Medio</th><th style={th}>Total</th><th style={th}>Items</th><th style={th}></th></tr></thead>
            <tbody>
              {borradores.map(c => (
                <tr key={c.id}>
                  <td style={td}>{fechaCorta(c.fecha)}</td>
                  <td style={td}>{c.proveedor?.nombre || 'Sin asignar'}</td>
                  <td style={td}>{labelMetodo(c.metodoPago || 'EFECTIVO')}</td>
                  <td style={{ ...td, fontWeight: 'bold' }}>${Number(c.total).toFixed(0)}</td>
                  <td style={td}>{c.detalles?.length || 0}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button onClick={() => cargarBorrador(c)} style={{ padding: '4px 8px', background: '#111827', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>Continuar</button>
                    <button onClick={() => eliminarBorrador(c)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: '#fff7ed', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #fed7aa' }}>
        <h4 style={{ marginTop: 0 }}>Registrar gasto</h4>
        <form onSubmit={registrarGasto} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 220, fontSize: 14 }}>Descripción
            <input value={gastoDesc} onChange={e => setGastoDesc(e.target.value)} placeholder="Ej: luz, gas, alquiler, sueldo..." style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          </label>
          <label style={{ width: 160, fontSize: 14 }}>Importe
            <input type="number" min="0" step="1" value={gastoImporte} onChange={e => setGastoImporte(e.target.value)} placeholder="0" style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          </label>
          <label style={{ width: 170, fontSize: 14 }}>Medio de pago
            <select value={gastoMetodo} onChange={e => setGastoMetodo(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}>
              {METODOS.filter(m => m.value !== 'CUENTA_CORRIENTE').map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={guardandoGasto || !cajaAbierta} style={{ padding: '8px 16px', background: cajaAbierta ? '#dc2626' : '#9ca3af', color: 'white', border: 'none', borderRadius: 6, cursor: cajaAbierta ? 'pointer' : 'not-allowed' }}>
            {guardandoGasto ? 'Registrando...' : 'Registrar gasto'}
          </button>
        </form>
        {!cajaAbierta && <small style={{ display: 'block', marginTop: 8, color: '#b91c1c' }}>No hay caja abierta en esta sucursal. Abrí la caja para registrar un gasto.</small>}
        {errorGasto && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 8, borderRadius: 6, marginTop: 8, fontSize: 13 }}>{errorGasto}</div>}
        {gastosCaja.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 13, color: '#9a3412', fontWeight: 600 }}>Últimas Tres</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
              <tbody>
                {gastosCaja.slice(-3).reverse().map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #ffedd5' }}>
                    <td style={{ padding: '4px 0', color: '#7c2d12' }}>{m.descripcion || m.tipo} <small style={{ color: '#9a3412' }}>· {labelMetodo(m.metodoPago || 'EFECTIVO')}</small></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#7c2d12' }}>${Math.round(m.monto).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setVerGastos(true)} style={{ padding: '6px 12px', background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Ver todos ({gastosCaja.length})</button>
              <small style={{ color: '#9a3412' }}>Total gastos de la caja: ${gastosCaja.reduce((a, m) => a + Math.round(m.monto), 0).toFixed(0)}</small>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: 'white', padding: 16, borderRadius: 8 }}>
        <h4>Historial compras</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Medio</th><th>Total</th><th>Items</th><th></th></tr></thead>
          <tbody>
            {historial.map(filaHistorial)}
            {historial.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin compras</td></tr>}
          </tbody>
        </table>
        {historialTotal > HIST_PAGE_SIZE && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => abrirHistorialCompleto(1)} style={{ padding: '8px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Ver todas ({historialTotal})
            </button>
          </div>
        )}
      </div>

      {verHistorialCompleto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={() => setVerHistorialCompleto(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', padding: 24, borderRadius: 12, width: 900, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Historial de compras ({histCompletoTotal})</h3>
              <button onClick={() => setVerHistorialCompleto(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Medio</th><th>Total</th><th>Items</th><th></th></tr></thead>
              <tbody>
                {histCompleto.map(filaHistorial)}
                {histCompleto.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin compras</td></tr>}
              </tbody>
            </table>
            {histCompletoPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <button disabled={histCompletoPage <= 1} onClick={() => abrirHistorialCompleto(histCompletoPage - 1)}
                  style={{ padding: '8px 14px', background: histCompletoPage <= 1 ? '#f3f4f6' : '#111827', color: histCompletoPage <= 1 ? '#9ca3af' : 'white', border: 'none', borderRadius: 6, cursor: histCompletoPage <= 1 ? 'default' : 'pointer' }}>
                  ← Anterior
                </button>
                <span style={{ fontSize: 13, color: '#374151' }}>Página {histCompletoPage} de {histCompletoPages}</span>
                <button disabled={histCompletoPage >= histCompletoPages} onClick={() => abrirHistorialCompleto(histCompletoPage + 1)}
                  style={{ padding: '8px 14px', background: histCompletoPage >= histCompletoPages ? '#f3f4f6' : '#111827', color: histCompletoPage >= histCompletoPages ? '#9ca3af' : 'white', border: 'none', borderRadius: 6, cursor: histCompletoPage >= histCompletoPages ? 'default' : 'pointer' }}>
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {verGastos && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={() => setVerGastos(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', padding: 24, borderRadius: 12, width: 640, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Gastos y retiros de la caja ({gastosCaja.length})</h3>
              <button onClick={() => setVerGastos(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Medio</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
              <tbody>
                {[...gastosCaja].reverse().map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 4px' }}>{fechaHora(m.createdAt)}</td>
                    <td>{m.tipo}</td>
                    <td>{m.descripcion || '-'}</td>
                    <td>{labelMetodo(m.metodoPago || 'EFECTIVO')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${Math.round(m.monto).toFixed(0)}</td>
                  </tr>
                ))}
                {gastosCaja.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin gastos</td></tr>}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 10 }}>Total</td><td style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: 10 }}>${gastosCaja.reduce((a, m) => a + Math.round(m.monto), 0).toFixed(0)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {ticket && createPortal(
        <div className="ticket-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50, overflow: 'auto' }} onClick={() => setTicket(null)}>
          <div id="ticket-print" onClick={e => e.stopPropagation()} style={{ background: 'white', padding: 24, borderRadius: 12, width: 640, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{user?.empresa?.nombre || 'Autoservicio'}</div>
              <div style={{ fontSize: 13, color: '#4b5563' }}>
                {ticket.estado === 'CONFIRMADA' ? 'Comprobante de compra' : 'Pedido de compra'}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{ticket.estado === 'BORRADOR' ? 'Pedido / Borrador' : ticket.estado === 'PENDIENTE' ? 'Pedido de compra' : 'Compra confirmada'}</h3>
              <button onClick={() => setTicket(null)} className="no-print" style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginTop: 16, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>Fecha</span><span>{fechaHora(ticket.fecha)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>Proveedor</span><span>{ticket.proveedor?.nombre || 'Sin asignar'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>Factura</span><span>{ticket.nroFactura || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>Medio de pago</span><span>{labelMetodo(ticket.metodoPago || 'EFECTIVO')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Estado</span>
                <span style={{ fontWeight: 600, color: ticket.estado === 'BORRADOR' ? '#b45309' : '#059669' }}>
                  {ticket.estado === 'BORRADOR' ? 'Borrador (no registrado)' : ticket.estado === 'PENDIENTE' ? 'Pendiente de confirmar' : 'Confirmada'}
                </span>
              </div>
            </div>

            <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f3f4f6' }}>
                <th style={th}>Producto</th><th style={th}>Cant</th><th style={th}>Costo</th>
                {ticket.estado === 'CONFIRMADA' && <th style={th}>Precio venta</th>}
                <th style={th}>Subtotal</th>
              </tr></thead>
              <tbody>
                {ticket.detalles?.map((d: any, i: number) => {
                  const pv = Math.round(Number(d.precioCosto) * (1 + (d.porcentajeCrecimiento ?? 10) / 100) * (1 + (d.porcentajeVenta ?? 30) / 100));
                  return (
                    <tr key={i}>
                      <td style={td}>{d.producto?.nombre}</td>
                      <td style={td}>{d.cantidad}</td>
                      <td style={td}>${Number(d.precioCosto).toFixed(0)}</td>
                      {ticket.estado === 'CONFIRMADA' && <td style={{ ...td, color: '#059669' }}>${pv.toFixed(0)}</td>}
                      <td style={td}>${Number(d.subtotal).toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={ticket.estado === 'CONFIRMADA' ? 4 : 3} style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>Total</td>
                  <td style={{ ...td, fontWeight: 'bold', fontSize: 15 }}>${Number(ticket.total).toFixed(0)}</td>
                </tr>
              </tfoot>
            </table>

            {error && <div className="no-print" style={{ marginTop: 12, background: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 6, fontSize: 14 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }} className="no-print">
              <button onClick={Imprimir} style={{ padding: '10px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Imprimir / PDF</button>
              {ticket.estado !== 'CONFIRMADA' && (
                <>
                  <button onClick={() => resolver('borrador')} disabled={guardando} style={{ padding: '10px 16px', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Guardar como borrador</button>
                  <button onClick={() => resolver('confirmar')} disabled={guardando} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{guardando ? 'Procesando...' : 'Confirmar compra'}</button>
                </>
              )}
              <button onClick={() => setTicket(null)} style={{ padding: '10px 16px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{ticket.estado === 'CONFIRMADA' ? 'Cerrar' : 'Volver'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
