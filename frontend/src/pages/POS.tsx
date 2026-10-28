import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';

interface Item {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  unidad?: string;
  comboGroupId?: string;
}

interface ComboItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioCosto?: number;
}

interface Combo {
  id: string;
  nombre: string;
  precioVenta: number;
  totalLista: number;
  items: ComboItem[];
}

interface ComboGroup {
  id: string;
  combo: Combo;
  aplicadoEn: number;
  itemsAsignados: Array<{ productoId: string; cantidad: number; precioUnitarioLista: number }>;
}

const esPeso = (x: { unidad?: string }) => x?.unidad === 'KG';
const unidadLabel = (_unidad?: string) => 'kg';
// El catálogo trae precioVenta; un ítem ya cargado trae precio. Sirve para ambos.
const precioDe = (p: any) => Number(p?.precioVenta ?? p?.precio) || 0;

const METODOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'CUENTA_CORRIENTE', label: 'Cuenta corriente' },
];

interface VentaPanelProps {
  canal?: number;
  activo?: boolean;
  titulo?: string;
  borde?: string;
  limpiarSignal?: number;
  onVentaCompletada?: () => void;
  onItemsChange?: (n: number) => void;
}

function VentaPanel({ canal = 1, activo = true, titulo = 'POS - Punto de Venta', borde, limpiarSignal = 0, onVentaCompletada, onItemsChange }: VentaPanelProps) {
  const [codigo, setCodigo] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [cajaAbierta, setCajaAbierta] = useState<any>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [pesoItem, setPesoItem] = useState<{ producto: any; code: string } | null>(null);
  const [pesoKg, setPesoKg] = useState('');
  const [pesoImporte, setPesoImporte] = useState('');
  const [combos, setCombos] = useState<Combo[]>([]);
  const [comboGroups, setComboGroups] = useState<ComboGroup[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pesoRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore(s => s.user);
  const sucursalId = user?.sucursalId || localStorage.getItem('sucursalId') || 'sucursal-central';

  useEffect(() => {
    checkCaja();
    fetchCatalog();
    fetchCombos();
  }, []);

  const fetchCombos = async () => {
    try {
      const { data } = await api.get('/productos/combos', { params: { sucursalId } });
      setCombos(data || []);
    } catch {}
  };

  // Cuando este POS pasa a estar visible, el foco va a su buscador
  useEffect(() => {
    if (activo) setTimeout(() => inputRef.current?.focus(), 80);
  }, [activo]);

  useEffect(() => {
    onItemsChange?.(items.length);
    setComboGroups(prev => recomputarComboGroups(items, combos, prev));
  }, [items, combos]);

  const fetchCatalog = async () => {
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
        if (page > 100) break;
      }
      setCatalog(all);
    } catch {}
  };

  const checkCaja = async () => {
    try {
      const { data } = await api.get('/caja/abierta', { params: { sucursalId } });
      setCajaAbierta(data);
    } catch { setCajaAbierta(null); }
  };

  const filteredSug = codigo ? catalog.filter(p => p.nombre.toLowerCase().includes(codigo.toLowerCase()) || (p.codigoBarras || '').includes(codigo)).slice(0, 6) : [];

  const recomputarComboGroups = (currentItems: Item[], combosDisponibles: Combo[], existing: ComboGroup[] = []): ComboGroup[] => {
    if (combosDisponibles.length === 0) return [];

    const disponibles = new Map<string, number>();
    for (const item of currentItems) {
      const key = item.id;
      const qty = Number(item.cantidad) || 0;
      if (qty <= 0 || !key) continue;
      disponibles.set(key, (disponibles.get(key) ?? 0) + qty);
    }

    const prioridad = [...existing, ...combosDisponibles.filter(c => !existing.some(e => e.combo.id === c.id)).map(combo => ({
      id: `${combo.id}-auto-${Date.now()}`,
      combo,
      aplicadoEn: Date.now(),
      itemsAsignados: [] as Array<{ productoId: string; cantidad: number; precioUnitarioLista: number }>,
    }))];

    const grupos: ComboGroup[] = [];
    const restantes = new Map(disponibles);

    for (const entry of prioridad) {
      const combo = entry.combo;
      if (!combo?.items?.length) continue;

      let maxCantidad = Number.POSITIVE_INFINITY;
      for (const ci of combo.items) {
        const requerido = Math.max(1, Number(ci.cantidad) || 1);
        const disponible = restantes.get(ci.productoId) ?? 0;
        if (disponible < requerido) {
          maxCantidad = 0;
          break;
        }
        maxCantidad = Math.min(maxCantidad, Math.floor(disponible / requerido));
      }

      if (maxCantidad <= 0) continue;

      const itemsAsignados = combo.items.map(ci => {
        const requerido = Math.max(1, Number(ci.cantidad) || 1);
        const cantidad = requerido * maxCantidad;
        const disponibleActual = restantes.get(ci.productoId) ?? 0;
        restantes.set(ci.productoId, Math.max(0, disponibleActual - cantidad));
        return { productoId: ci.productoId, cantidad, precioUnitarioLista: Number(ci.precioUnitario) || 0 };
      });

      grupos.push({
        id: `${combo.id}-${grupos.length}-${Date.now()}`,
        combo,
        aplicadoEn: Date.now() + grupos.length,
        itemsAsignados,
      });
    }

    return grupos;
  };

  const abrirPeso = (producto: any, code: string, kgExistente?: number) => {
    setPesoItem({ producto, code });
    if (kgExistente !== undefined && kgExistente > 0) {
      setPesoKg(String(kgExistente));
      setPesoImporte(String(Math.round(precioDe(producto) * kgExistente)));
    } else {
      setPesoKg(''); setPesoImporte('');
    }
    setTimeout(() => pesoRef.current?.focus(), 80);
  };

  const onPesoImporte = (v: string) => {
    setPesoImporte(v);
    const imp = parseFloat(v.replace(',', '.'));
    const precio = pesoItem ? precioDe(pesoItem.producto) : 0;
    if (!isNaN(imp) && precio > 0) setPesoKg((Math.round((imp / precio) * 1000) / 1000).toFixed(3));
    else setPesoKg('');
  };

  const confirmarPeso = () => {
    if (!pesoItem) return;
    const kg = parseFloat(pesoKg.replace(',', '.'));
    if (isNaN(kg) || kg <= 0) { setError('Ingresá un importe válido'); return; }
    const precio = Math.round(precioDe(pesoItem.producto));
    const code = pesoItem.code;
    setItems(prev => {
      const existe = prev.find(i => i.codigo === code);
      if (existe) return prev.map(i => (i.codigo === code ? { ...i, cantidad: kg } : i));
      return [...prev, { id: pesoItem.producto.id, codigo: code, nombre: pesoItem.producto.nombre, precio, cantidad: kg, unidad: pesoItem.producto.unidad }];
    });
    setPesoItem(null); setPesoKg(''); setPesoImporte('');
    setCodigo(''); setShowSug(false); setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const addProducto = (producto: any, code?: string) => {
    setError(''); setSuccess(''); setAviso('');
    const c = code || producto.codigoBarras || producto.nombre;
    if (esPeso(producto)) {
      const existe = items.find(i => i.codigo === c);
      setCodigo(''); setShowSug(false);
      abrirPeso(producto, c, existe?.cantidad);
      return;
    }
    const ya = items.find((p) => p.id === producto.id);
    if (ya) {
      setAviso(`Producto ya cargado: ${producto.nombre}`);
      setCodigo(''); setShowSug(false);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    setItems((prev) => [...prev, { id: producto.id, codigo: c, nombre: producto.nombre, precio: Number(producto.precioVenta), cantidad: 1 }]);
    setCodigo(''); setShowSug(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleScan = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && codigo.trim()) {
      const code = codigo.trim();
      // Primero buscar en catálogo local por código exacto o nombre
      const local = catalog.find(p => p.codigoBarras === code || p.nombre.toLowerCase() === code.toLowerCase());
      if (local) { addProducto(local, code); return; }
      // Si hay sugerencias, se carga la primera de la lista
      if (filteredSug.length > 0) { addProducto(filteredSug[0]); return; }
      // Fallback a API por código
      setError(''); setSuccess(''); setAviso('');
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

  const freeAmountByProduct = new Map<string, number>();
  for (const item of items) {
    freeAmountByProduct.set(item.id, (freeAmountByProduct.get(item.id) ?? 0) + Number(item.cantidad || 0));
  }
  for (const group of comboGroups) {
    for (const assigned of group.itemsAsignados) {
      const actual = freeAmountByProduct.get(assigned.productoId) ?? 0;
      freeAmountByProduct.set(assigned.productoId, Math.max(0, actual - assigned.cantidad));
    }
  }

  const productosSueltos = items.filter(item => (freeAmountByProduct.get(item.id) ?? 0) > 0);
  const totalBruto = items.reduce((acc, i) => acc + Math.round(i.precio * i.cantidad), 0);
  const totalListaCombo = comboGroups.reduce((acc, group) => acc + Math.round(group.combo.totalLista || 0), 0);
  const totalCombo = comboGroups.reduce((acc, group) => acc + Math.round(group.combo.precioVenta || group.combo.totalLista || 0), 0);
  const totalSueltos = productosSueltos.reduce((acc, item) => acc + Math.round(item.precio * (freeAmountByProduct.get(item.id) ?? 0)), 0);
  const total = Math.max(0, totalCombo + totalSueltos);

  useEffect(() => {
    if (metodoPago !== 'CUENTA_CORRIENTE') return;
    const t = setTimeout(() => {
      if (!clienteSearch) { setClientes([]); return; }
      api.get('/clientes', { params: { search: clienteSearch } })
        .then(r => setClientes(r.data))
        .catch(() => setClientes([]));
    }, 300);
    return () => clearTimeout(t);
  }, [clienteSearch, metodoPago]);

  const limpiar = () => {
    setItems([]); setCodigo(''); setError(''); setAviso(''); setSuccess('');
    setMetodoPago('EFECTIVO'); setClienteId(''); setClienteSearch(''); setClientes([]);
    setComboGroups([]);
  };

  // El padre puede vaciar este POS (botón "Limpiar" de la ventana flotante)
  useEffect(() => { if (limpiarSignal > 0) limpiar(); }, [limpiarSignal]);

  const handleCobrar = async () => {
    if (!cajaAbierta) { setError('No hay caja abierta. Abrí la caja primero en la sección Caja.'); return; }
    const hayItems = items.length > 0 || comboGroups.length > 0;
    if (!hayItems) return;
    if (metodoPago === 'CUENTA_CORRIENTE' && !clienteId) { setError('Seleccioná cliente para cuenta corriente'); return; }
    setCobrando(true); setError(''); setSuccess('');
    try {
      const ventaItems: any[] = [];

      for (const group of comboGroups) {
        const lista = group.combo.totalLista || group.combo.items.reduce((acc, ci) => acc + Math.round((ci.precioUnitario || 0) * (Number(ci.cantidad) || 1)), 0);
        const precioCombo = Math.round(group.combo.precioVenta || lista);
        const factor = lista > 0 ? precioCombo / lista : 1;

        for (const ci of group.combo.items) {
          const cantidad = Number(ci.cantidad) || 1;
          const precioLista = Math.round((ci.precioUnitario || 0) * cantidad);
          const subtotal = Math.round(precioLista * factor);
          const precioUnitario = Math.round(subtotal / cantidad);
          ventaItems.push({
            productoId: ci.productoId,
            cantidad,
            precioUnitario,
            subtotal,
            comboId: group.id,
            precioLista: Math.round(ci.precioUnitario || 0),
            esComboItem: true,
          });
        }
      }

      const restantes = new Map<string, number>();
      for (const item of items) {
        restantes.set(item.id, (restantes.get(item.id) ?? 0) + Number(item.cantidad || 0));
      }
      for (const group of comboGroups) {
        for (const assigned of group.itemsAsignados) {
          const actual = restantes.get(assigned.productoId) ?? 0;
          restantes.set(assigned.productoId, Math.max(0, actual - assigned.cantidad));
        }
      }

      for (const item of items) {
        const disponible = Math.max(0, (restantes.get(item.id) ?? 0));
        if (disponible <= 0) continue;
        const cantidadIndividual = Math.min(Number(item.cantidad || 0), disponible);
        if (cantidadIndividual <= 0) continue;
        ventaItems.push({
          productoId: item.id,
          cantidad: cantidadIndividual,
          precioUnitario: item.precio,
          subtotal: Math.round(item.precio * cantidadIndividual),
          esComboItem: false,
        });
      }

      console.log('Payload venta a enviar', JSON.stringify({
        sucursalId,
        metodoPago,
        descuento: 0,
        cajaId: cajaAbierta.id,
        clienteId: metodoPago === 'CUENTA_CORRIENTE' ? clienteId : undefined,
        items: ventaItems,
      }, null, 2));

      const { data } = await api.post('/ventas', {
        sucursalId,
        metodoPago,
        descuento: 0,
        cajaId: cajaAbierta.id,
        clienteId: metodoPago === 'CUENTA_CORRIENTE' ? clienteId : undefined,
        items: ventaItems,
      });
      setSuccess(`Venta #${data.nroComprobante} por $${Number(data.total).toFixed(0)} registrada`);
      limpiar();
      checkCaja();
      onVentaCompletada?.();
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cobrar');
    } finally { setCobrando(false); }
  };

  // Atajo F12: solo responde el POS que está activo (visible)
  useEffect(() => {
    if (!activo) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'F12') { e.preventDefault(); handleCobrar(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, cajaAbierta, metodoPago, clienteId, activo]);

  return (
    <>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
      <div style={{ background: 'white', padding: 20, borderRadius: 8, border: borde ? `2px solid ${borde}` : 'none' }}>
        <h2 style={{ marginTop: 0 }}>{titulo}</h2>
        {!cajaAbierta ? (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 6, marginTop: 8 }}>
            ⚠️ No hay caja abierta para esta sucursal. <a href="/caja" style={{ color: '#dc2626', fontWeight: 'bold' }}>Abrir caja</a> para poder cobrar.
          </div>
        ) : (
          <small style={{ color: '#059669' }}>✓ Caja abierta - Inicial: ${Number(cajaAbierta.montoInicial).toFixed(0)}</small>
        )}
        <div style={{ position: 'relative' }}>
          <input ref={inputRef} value={codigo} onChange={(e) => { setCodigo(e.target.value); setShowSug(true); }} onKeyDown={handleScan} onFocus={() => setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 200)}
            placeholder="Escaneá código o escribí nombre... (ej: Yerba o 7790000000011)" style={{ width: '100%', padding: 16, fontSize: 18, marginTop: 12, border: '2px solid #111827', borderRadius: 8, boxSizing: 'border-box' }} />
          {showSug && filteredSug.length > 0 && (
            <div style={{ position: 'absolute', top: 58, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 20 }}>
              {filteredSug.map(p => (
                <div key={p.id} onMouseDown={() => addProducto(p)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{p.nombre} <code style={{ fontSize: 11, color: '#6b7280' }}>{p.codigoBarras || ''}</code></span><span style={{ fontWeight: 'bold' }}>${Number(p.precioVenta).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {loading && <small style={{ color: '#2563eb' }}>Buscando...</small>}
        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 6, marginTop: 8 }}>{error}</div>}
        {aviso && <div style={{ background: '#fffbeb', color: '#b45309', padding: 10, borderRadius: 6, marginTop: 8, border: '1px solid #fde68a' }}>⚠️ {aviso}</div>}
        {success && <div style={{ background: '#ecfdf5', color: '#059669', padding: 10, borderRadius: 6, marginTop: 8 }}>{success}</div>}

        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Código</th><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.codigo} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td>{item.codigo}</td><td>{item.nombre}</td>
                <td>
                  {esPeso(item) ? (
                    <span>
                      {item.cantidad.toFixed(3)} {unidadLabel(item.unidad)}{' '}
                      <button onClick={() => abrirPeso(item, item.codigo, item.cantidad)} style={{ padding: '2px 6px', cursor: 'pointer' }} title="Editar peso">✏️</button>
                    </span>
                  ) : (
                    <><button onClick={() => updateCantidad(item.codigo, -1)} style={{ padding: '2px 6px' }}>-</button><span style={{ margin: '0 8px' }}>{item.cantidad}</span><button onClick={() => updateCantidad(item.codigo, 1)} style={{ padding: '2px 6px' }}>+</button></>
                  )}
                </td>
                <td>${item.precio.toFixed(0)}{esPeso(item) ? `/${unidadLabel(item.unidad)}` : ''}</td><td>${Math.round(item.precio * item.cantidad).toFixed(0)}</td>
                <td><button onClick={() => removeItem(item.codigo)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin productos - Probá 7790000000011</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ background: 'white', padding: 20, borderRadius: 8, height: 'fit-content', border: borde ? `2px solid ${borde}` : 'none' }}>
        <h3 style={{ marginTop: 0 }}>Resumen</h3>
        {comboGroups.length > 0 ? (
          <>
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>Combos aplicados</div>
              {comboGroups.map((group) => (
                <div key={group.id} style={{ marginTop: 6 }}>
                  • {group.combo.nombre} · ${Math.round(group.combo.precioVenta || group.combo.totalLista || 0).toFixed(0)}
                </div>
              ))}
              <div style={{ marginTop: 8 }}>Total combos: ${totalCombo.toFixed(0)}</div>
              <div>Ahorro estimado: ${Math.max(0, totalListaCombo - totalCombo).toFixed(0)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span>Total combos</span><span>${totalCombo.toFixed(0)}</span></div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span>Subtotal</span><span>${totalBruto.toFixed(0)}</span></div>
        )}
        {productosSueltos.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span>Productos sueltos</span><span>${totalSueltos.toFixed(0)}</span></div>
        )}
        <div style={{ fontSize: 36, fontWeight: 'bold', margin: '16px 0' }}>${total.toFixed(0)}</div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Tipo de cobro</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {METODOS_PAGO.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setMetodoPago(value);
                  if (value !== 'CUENTA_CORRIENTE') { setClienteId(''); setClienteSearch(''); setClientes([]); }
                }}
                style={{
                  padding: '12px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: metodoPago === value ? 'bold' : 'normal',
                  border: metodoPago === value ? '2px solid #111827' : '1px solid #d1d5db',
                  background: metodoPago === value ? '#111827' : 'white',
                  color: metodoPago === value ? 'white' : '#111827',
                }}
              >
                {metodoPago === value ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
        </div>
        {metodoPago === 'CUENTA_CORRIENTE' && (
          <div style={{ marginTop: 10 }}>
            <input placeholder="Buscar cliente por nombre o teléfono" value={clienteSearch} onChange={e => setClienteSearch(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
            {clientes.length > 0 && clienteSearch && (
              <div style={{ marginTop: 6, maxHeight: 160, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                {clientes.map((c: any) => (
                  <div key={c.id} onMouseDown={() => { setClienteId(c.id); setClienteSearch(c.nombre); setClientes([]); }} style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: clienteId === c.id ? '#f3f4f6' : 'white' }}>
                    <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                    <small style={{ color: '#6b7280' }}>{c.telefono || '-'} · Saldo ${Number(c.saldoCuenta).toFixed(0)}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={handleCobrar} disabled={items.length === 0 || cobrando || !cajaAbierta} style={{ width: '100%', padding: 14, marginTop: 20, background: !cajaAbierta ? '#9ca3af' : '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: cobrando ? 'wait' : 'pointer', opacity: cobrando ? 0.7 : 1 }}>
          {cobrando ? 'Cobrando...' : `COBRAR ${canal === 1 ? '(F12)' : ''}`.trim()}
        </button>
        {!cajaAbierta && <small style={{ color: '#dc2626' }}>Abrí la caja para cobrar</small>}
        <button style={{ width: '100%', padding: 10, marginTop: 8, background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={limpiar}>
          Cancelar
        </button>
      </div>
    </div>

    {pesoItem && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 90 }} onClick={() => { setPesoItem(null); setTimeout(() => inputRef.current?.focus(), 50); }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 420 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{pesoItem.producto.nombre}</h3>
            <button onClick={() => { setPesoItem(null); setTimeout(() => inputRef.current?.focus(), 50); }} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ color: '#6b7280', marginTop: 4 }}>
            ${precioDe(pesoItem.producto).toFixed(0)} por {unidadLabel(pesoItem.producto.unidad)}
          </div>
          <label style={{ display: 'block', marginTop: 16, fontSize: 14, color: '#374151' }}>Importe ($)</label>
          <input ref={pesoRef} type="text" inputMode="numeric" value={pesoImporte} onChange={e => onPesoImporte(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmarPeso(); if (e.key === 'Escape') { setPesoItem(null); setTimeout(() => inputRef.current?.focus(), 50); } }} placeholder="0" style={{ width: '100%', padding: 14, fontSize: 24, marginTop: 4, border: '2px solid #111827', borderRadius: 8, boxSizing: 'border-box', textAlign: 'right' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '10px 12px', background: '#f3f4f6', borderRadius: 8 }}>
            <span style={{ fontSize: 14, color: '#374151' }}>Peso ({unidadLabel(pesoItem.producto.unidad)})</span>
            <strong style={{ fontSize: 22 }}>{pesoKg || '0.000'}</strong>
          </div>
          <small style={{ color: '#6b7280' }}>Cargá el importe: el peso se calcula solo.</small>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={confirmarPeso} style={{ flex: 1, padding: 14, background: '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 600 }}>Agregar</button>
            <button onClick={() => { setPesoItem(null); setTimeout(() => inputRef.current?.focus(), 50); }} style={{ padding: '14px 18px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default function POS() {
  const [mostrarSegundo, setMostrarSegundo] = useState(false);
  const [itemsSegundo, setItemsSegundo] = useState(0);
  const [limpiarSegundo, setLimpiarSegundo] = useState(0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => setMostrarSegundo(true)}
          style={{ padding: '10px 16px', background: '#0f766e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
        >
          🧾 Abrir POS 2{itemsSegundo > 0 ? ` (${itemsSegundo} ítem${itemsSegundo === 1 ? '' : 's'} en curso)` : ''}
        </button>
      </div>

      <VentaPanel canal={1} activo={!mostrarSegundo} />

      {/* POS 2: queda montado siempre (no se pierde lo cargado), oculto hasta que se abre */}
      <div style={{ display: mostrarSegundo ? 'block' : 'none' }}>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 80, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f766e', color: 'white', padding: '10px 16px', borderRadius: '8px 8px 0 0' }}>
              <strong>POS 2 — venta en curso del otro cliente</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setLimpiarSegundo(k => k + 1); setMostrarSegundo(false); }} style={{ padding: '6px 12px', background: '#fef3c7', color: '#92400e', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  🧹 Limpiar y ocultar
                </button>
                <button onClick={() => setMostrarSegundo(false)} style={{ padding: '6px 12px', background: 'white', color: '#0f766e', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  Ocultar POS 2 (lo cargado se conserva)
                </button>
              </div>
            </div>
            <div style={{ background: '#f9fafb', padding: 16, borderRadius: '0 0 8px 8px' }}>
              <VentaPanel canal={2} activo={mostrarSegundo} borde="#0f766e" titulo="POS 2 - Punto de Venta" limpiarSignal={limpiarSegundo} onVentaCompletada={() => setMostrarSegundo(false)} onItemsChange={setItemsSegundo} />
              <small style={{ display: 'block', marginTop: 12, color: '#6b7280' }}>
                Al concretar la venta, el POS 2 se oculta solo y lo que quedó cargado se descarta. Si lo ocultás antes de cobrar, la venta se conserva para retomarla.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
