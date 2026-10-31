import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Empleados() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [form, setForm] = useState({ username: '', password: '', rol: 'CAJERO' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const fetchEmpleados = async () => {
    const { data } = await api.get('/usuarios');
    setEmpleados(data);
  };

  useEffect(() => { fetchEmpleados(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const username = form.username.trim();
      await api.post('/usuarios', { ...form, username, nombre: username });
      setSuccess(`Empleado ${username} creado`);
      setForm({ username: '', password: '', rol: 'CAJERO' });
      fetchEmpleados();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const toggleActivo = async (emp: any) => {
    try {
      await api.patch(`/usuarios/${emp.id}`, { activo: !emp.activo });
      fetchEmpleados();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const eliminarEmpleado = async (emp: any) => {
    if (!window.confirm(`¿Eliminar definitivamente a '${emp.nombre}'? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/usuarios/${emp.id}`);
      setSuccess(`Empleado ${emp.nombre} eliminado`);
      fetchEmpleados();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const cambiarRol = async (emp: any, rol: string) => {
    if (rol === emp.rol) return;
    try {
      await api.patch(`/usuarios/${emp.id}`, { rol });
      setSuccess(`Rol de ${emp.nombre} actualizado a ${rol}`);
      fetchEmpleados();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
  };

  const hayAdmin = empleados.some(e => e.rol === 'ADMIN' && e.activo);
  const rolesDisponibles = (esAdmin: boolean) =>
    ['ADMIN', 'CAJERO', 'REPOSITOR', 'ELABORACION'].filter(r => esAdmin || r !== 'ADMIN' || !hayAdmin);

  return (
    <div>
      <h2>Empleados</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      {success && <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 6, marginBottom: 10, color: '#065f46' }}>{success}</div>}

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Alta empleado</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input required minLength={3} name="employee-username" autoComplete="off" placeholder="Nombre (será el usuario)*" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <div style={{ position: 'relative' }}>
            <input required placeholder="Contraseña*" type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ width: '100%', padding: 8, paddingRight: 36, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>{showPassword ? '🙈' : '👁️'}</button>
          </div>
          <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="ADMIN" disabled={hayAdmin}>ADMIN (todo){hayAdmin ? ' — ya existe uno' : ''}</option>
            <option value="CAJERO">CAJERO (POS + ventas)</option>
            <option value="REPOSITOR">REPOSITOR (stock y compras)</option>
            <option value="ELABORACION">ELABORACION (stock y producción)</option>
          </select>
          <button type="submit" style={{ padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Crear empleado</button>
        </form>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <button type="button" onClick={() => setShowInfo(true)} style={{ padding: '4px 10px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Más info</button>
        </div>
      </div>

      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Nombre / usuario</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>
          {empleados.map(emp => (
            <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: emp.activo ? 1 : 0.5 }}>
              <td style={{ padding: 10 }}>{emp.username || emp.nombre}</td>
              <td>
                <select
                  value={emp.rol}
                  disabled={emp.rol === 'ADMIN'}
                  onChange={e => cambiarRol(emp, e.target.value)}
                  title={emp.rol === 'ADMIN' ? 'El rol del ADMIN es único y no se puede cambiar' : 'Cambiar rol'}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, background: emp.rol === 'ADMIN' ? '#111827' : 'white', color: emp.rol === 'ADMIN' ? 'white' : '#111827', cursor: 'pointer' }}
                >
                  {rolesDisponibles(emp.rol === 'ADMIN').map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td>{emp.activo ? '🟢 Activo' : '🔴 Inactivo'}</td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleActivo(emp)} disabled={emp.rol === 'ADMIN'} title={emp.rol === 'ADMIN' ? 'El ADMIN no se puede desactivar' : ''} style={{ padding: '6px 10px', background: emp.activo ? '#fee2e2' : '#ecfdf5', color: emp.activo ? '#b91c1c' : '#065f46', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, opacity: emp.rol === 'ADMIN' ? 0.5 : 1 }}>
                    {emp.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => eliminarEmpleado(emp)} disabled={emp.rol === 'ADMIN'} title={emp.rol === 'ADMIN' ? 'El ADMIN no se puede eliminar' : ''} style={{ padding: '6px 10px', background: '#b91c1c', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, opacity: emp.rol === 'ADMIN' ? 0.5 : 1 }}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {empleados.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin empleados</td></tr>}
        </tbody>
      </table>

      {showInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={() => setShowInfo(false)}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 520, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Permisos por rol</h3>
              <button onClick={() => setShowInfo(false)} style={{ border: 'none', background: '#e5e7eb', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Pestaña</th>
                  <th style={{ textAlign: 'center', padding: 8 }}>ADMIN</th>
                  <th style={{ textAlign: 'center', padding: 8 }}>CAJERO</th>
                  <th style={{ textAlign: 'center', padding: 8 }}>REPOSITOR</th>
                  <th style={{ textAlign: 'center', padding: 8 }}>ELABORACION</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Dashboard', true, false, false, false],
                  ['POS / Ventas', true, true, false, false],
                  ['Productos', true, true, true, true],
                  ['Stock', true, true, true, true],
                  ['Compras/Gastos', true, true, true, true],
                  ['Movimientos', true, false, false, false],
                  ['Clientes', true, true, false, false],
                  ['Proveedores', true, true, false, false],
                  ['Caja', true, true, true, true],
                  ['Empleados', true, false, false, false],
                ].map(([tab, a, c, r, e]) => (
                  <tr key={tab as string} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: 8 }}>{tab}</td>
                    <td style={{ textAlign: 'center' }}>{a ? '✓' : '✗'}</td>
                    <td style={{ textAlign: 'center' }}>{c ? '✓' : '✗'}</td>
                    <td style={{ textAlign: 'center' }}>{r ? '✓' : '✗'}</td>
                    <td style={{ textAlign: 'center' }}>{e ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small style={{ display: 'block', marginTop: 12, color: '#6b7280' }}>REPOSITOR y ELABORACION funcionan igual, solo cambia el nombre.</small>
          </div>
        </div>
      )}
    </div>
  );
}
