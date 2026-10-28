import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fechaCorta } from '../lib/fecha';

export default function Clientes() {
  const [all, setAll] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '' });
  const [search, setSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [cuenta, setCuenta] = useState<any>(null);
  const [cajaAbierta, setCajaAbierta] = useState<any>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('EFECTIVO');
  const [pagoOk, setPagoOk] = useState('');

  // Edición de datos + ajuste de la deuda (para migrar saldos anteriores)
  const [editForm, setEditForm] = useState<any>(null);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [ajusteMonto, setAjusteMonto] = useState('');
  const [ajusteDesc, setAjusteDesc] = useState('');
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  const METODOS_PAGO = [
    { value: 'EFECTIVO', label: 'Efectivo' },
    { value: 'TRANSFERENCIA', label: 'Transferencia' },
    { value: 'TARJETA', label: 'Tarjeta' },
  ];
  const saldo = cuenta ? Number(cuenta.saldo) : 0;

  const fetch = async () => {
    const { data } = await api.get('/clientes');
    setAll(data); setList(data);
  };
  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    const sucursalId = localStorage.getItem('sucursalId');
    if (!sucursalId) { setCajaAbierta(null); return; }
    api.get('/caja/abierta', { params: { sucursalId } })
      .then(r => setCajaAbierta(r.data))
      .catch(() => setCajaAbierta(null));
  }, [selected]);

  useEffect(() => {
    if (!search) { setList(all); setShowSug(false); return; }
    const f = all.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.dni || '').includes(search));
    setList(f);
    setShowSug(f.length > 0 && f.length !== all.length);
  }, [search, all]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await api.post('/clientes', form);
      setForm({ nombre: '', telefono: '', direccion: '' });
      fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const verCuenta = async (id: string) => {
    const { data } = await api.get(`/clientes/${id}/cuenta`);
    setCuenta(data); setSelected(data.cliente);
    setEditForm({ nombre: data.cliente.nombre, dni: data.cliente.dni || '', telefono: data.cliente.telefono || '', email: data.cliente.email || '', direccion: data.cliente.direccion || '' });
    setAjusteMonto(''); setAjusteDesc(''); setPagoOk(''); setError('');
  };

  const guardarEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!editForm.nombre.trim()) { setError('El nombre no puede quedar vacío.'); return; }
    setGuardandoEdit(true);
    try {
      await api.patch(`/clientes/${selected.id}`, editForm);
      fetch(); verCuenta(selected.id);
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setGuardandoEdit(false); }
  };

  const aplicarAjuste = async (signo: 1 | -1) => {
    setError('');
    const monto = Math.round(parseFloat(ajusteMonto) || 0) * signo;
    if (!monto) { setError('Poné un monto distinto de cero.'); return; }
    setGuardandoAjuste(true);
    try {
      await api.post(`/clientes/${selected.id}/ajuste`, {
        monto,
        descripcion: ajusteDesc.trim() || (monto > 0 ? 'Deuda anterior al sistema' : 'Ajuste de deuda'),
      });
      setAjusteMonto(''); setAjusteDesc('');
      verCuenta(selected.id); fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setGuardandoAjuste(false); }
  };

  const handlePago = async () => {
    if (!selected) return;
    setError('');
    try {
      await api.post(`/clientes/${selected.id}/pago`, {
        monto: Math.round(parseFloat(pagoMonto) || 0),
        metodoPago: pagoMetodo,
        sucursalId: localStorage.getItem('sucursalId') || undefined,
      });
      const nuevoSaldo = Number(selected.saldoCuenta) - Math.round(parseFloat(pagoMonto) || 0);
      setPagoMonto(''); setPagoMetodo('EFECTIVO'); setPagoOk(`Pago registrado. Nuevo saldo: $${nuevoSaldo.toFixed(0)}`);
      verCuenta(selected.id); fetch();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  return (
    <div>
      <h2>Clientes</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input placeholder="Buscar por nombre... (filtra la lista)" value={search} onChange={e => setSearch(e.target.value)} onFocus={() => search && setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 200)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          {showSug && (
            <div style={{ position: 'absolute', top: 42, left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
              {list.slice(0, 5).map(c => (
                <div key={c.id} onMouseDown={() => { setSearch(c.nombre); setShowSug(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.nombre} {c.dni ? `(${c.dni})` : ''}</span><span style={{ color: c.saldoCuenta > 0 ? '#dc2626' : '#059669' }}>${Number(c.saldoCuenta).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setSearch(''); setList(all); }} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Limpiar</button>
      </div>

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Alta cliente</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input required placeholder="Nombre*" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Teléfono (solo números)" inputMode="numeric" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <button type="submit" style={{ padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Crear</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        <table style={{ background: 'white', borderRadius: 8, borderCollapse: 'collapse', height: 'fit-content' }}>
          <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Nombre</th><th>Teléfono</th><th>Saldo</th><th>Acción</th></tr></thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 10 }}>{c.nombre}</td><td>{c.telefono || '-'}</td>
                <td style={{ color: c.saldoCuenta > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }}>${Number(c.saldoCuenta).toFixed(0)}</td>
                <td><button onClick={() => verCuenta(c.id)} style={{ padding: '6px 10px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ver</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin clientes</td></tr>}
          </tbody>
        </table>

        <div style={{ background: 'white', padding: 16, borderRadius: 8, height: 'fit-content' }}>
          {!selected ? <p style={{ color: '#9ca3af' }}>Seleccioná un cliente para ver su cuenta corriente</p> : (
            <>
              <h4 style={{ margin: 0 }}>{selected.nombre}</h4>
              <div style={{ background: saldo > 0 ? '#fef2f2' : '#ecfdf5', border: saldo > 0 ? '1px solid #fecaca' : '1px solid #a7f3d0', padding: 12, borderRadius: 8, marginTop: 8, textAlign: 'center' }}>
                <small style={{ color: '#6b7280' }}>Saldo a pagar</small>
                <p style={{ fontSize: 26, fontWeight: 'bold', margin: 0, color: saldo > 0 ? '#dc2626' : '#059669' }}>${saldo.toFixed(0)}</p>
              </div>

              {editForm && (
                <form onSubmit={guardarEdit} style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <h5 style={{ margin: '0 0 8px' }}>Datos del cliente</h5>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <input required placeholder="Nombre*" value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                    <input placeholder="Teléfono" inputMode="numeric" value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value.replace(/\D/g, '') })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                    <input placeholder="Dirección" value={editForm.direccion} onChange={e => setEditForm({ ...editForm, direccion: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                    <button type="submit" disabled={guardandoEdit} style={{ padding: '8px 12px', background: guardandoEdit ? '#9ca3af' : '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              )}

              {cuenta && (
                <div style={{ marginTop: 12, border: '1px dashed #fbbf24', background: '#fffbeb', borderRadius: 8, padding: 12 }}>
                  <h5 style={{ margin: '0 0 4px' }}>Ajustar deuda</h5>
                  <small style={{ color: '#92400e' }}>Para cargar la deuda que el cliente ya traía antes del sistema (o corregirla). No afecta la caja.</small>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                    <input type="number" min="0" step="1" placeholder="Monto" value={ajusteMonto} onChange={e => setAjusteMonto(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                    <input placeholder="Motivo (opcional)" value={ajusteDesc} onChange={e => setAjusteDesc(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button type="button" disabled={guardandoAjuste || !ajusteMonto} onClick={() => aplicarAjuste(1)} style={{ flex: 1, padding: '8px 12px', background: guardandoAjuste || !ajusteMonto ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ Sumar deuda</button>
                    <button type="button" disabled={guardandoAjuste || !ajusteMonto || saldo <= 0} onClick={() => aplicarAjuste(-1)} style={{ flex: 1, padding: '8px 12px', background: guardandoAjuste || !ajusteMonto || saldo <= 0 ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>− Restar deuda</button>
                  </div>
                </div>
              )}

              {cuenta && (
                <>
                  <div style={{ marginTop: 12 }}>
                    <h5 style={{ marginBottom: 6 }}>Cobrar pago</h5>
                    {!cajaAbierta && (
                      <div style={{ background: '#fef2f2', color: '#dc2626', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
                        No hay caja abierta en esta sucursal. Abrí la caja para poder cobrar.
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      {METODOS_PAGO.map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setPagoMetodo(value)}
                          style={{
                            padding: '10px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                            border: pagoMetodo === value ? '2px solid #111827' : '1px solid #d1d5db',
                            background: pagoMetodo === value ? '#111827' : 'white',
                            color: pagoMetodo === value ? 'white' : '#111827',
                            fontWeight: pagoMetodo === value ? 'bold' : 'normal',
                          }}
                        >
                          {pagoMetodo === value ? '✓ ' : ''}{label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input type="number" min="0" step="1" placeholder="Monto" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
                      {saldo > 0 && <button onClick={() => setPagoMonto(String(saldo))} style={{ padding: '8px 10px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Total</button>}
                      <button onClick={handlePago} disabled={!pagoMonto || parseFloat(pagoMonto) <= 0 || saldo <= 0 || !cajaAbierta} style={{ padding: '8px 12px', background: saldo > 0 && pagoMonto && cajaAbierta ? '#059669' : '#9ca3af', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cobrar</button>
                    </div>
                    {pagoOk && <div style={{ background: '#ecfdf5', color: '#059669', padding: 8, borderRadius: 6, marginTop: 8 }}>{pagoOk}</div>}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <h5 style={{ margin: 0 }}>Resumen de cuenta</h5>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                      <span>Deuda ({cuenta.ventas?.filter((v: any) => v.estado !== 'CANCELADA').length || 0} ventas)</span>
                      <span>${Number(cuenta.totalDeuda || 0).toFixed(0)}</span>
                    </div>
                    {Number(cuenta.totalAjustes || 0) !== 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b45309' }}>
                        <span>Ajustes de deuda</span>
                        <span>{Number(cuenta.totalAjustes) > 0 ? '+' : '-'}${Math.abs(Number(cuenta.totalAjustes)).toFixed(0)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
                      <span>Pagos ({cuenta.pagos?.filter((p: any) => (p.tipo || 'PAGO') === 'PAGO').length || 0})</span>
                      <span>-${Number(cuenta.totalPagado || 0).toFixed(0)}</span>
                    </div>

                    {cuenta.ventas?.length > 0 && (
                      <>
                        <h6 style={{ margin: '12px 0 4px' }}>Ventas a cuenta</h6>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead><tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
                          <tbody>
                            {cuenta.ventas.map((v: any) => (
                              <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}><td>{fechaCorta(v.fecha)}</td><td>${Number(v.total).toFixed(0)}</td><td>{v.estado}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {cuenta.pagos?.length > 0 && (
                      <>
                        <h6 style={{ margin: '12px 0 4px' }}>Movimientos de cuenta</h6>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead><tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}><th>Fecha</th><th>Monto</th><th>Medio</th></tr></thead>
                          <tbody>
                            {cuenta.pagos.map((p: any) => {
                              const esAjuste = (p.tipo || 'PAGO') !== 'PAGO';
                              return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td>{fechaCorta(p.fecha)}</td>
                                  <td style={{ color: esAjuste ? '#b45309' : '#059669', fontWeight: 'bold' }}>
                                    {esAjuste ? (p.tipo === 'AJUSTE_POSITIVO' ? '+' : '-') + '$' : '-$'}{Number(p.monto).toFixed(0)}
                                  </td>
                                  <td>{esAjuste ? 'Ajuste' : p.metodoPago}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
