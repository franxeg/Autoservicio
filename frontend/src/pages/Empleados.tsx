import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Empleados() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [form, setForm] = useState({ username: '', password: '', nombre: '', rol: 'CAJERO' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchEmpleados = async () => {
    const { data } = await api.get('/usuarios');
    setEmpleados(data);
  };

  useEffect(() => { fetchEmpleados(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      await api.post('/usuarios', form);
      setSuccess(`Empleado ${form.nombre} creado`);
      setForm({ username: '', password: '', nombre: '', rol: 'CAJERO' });
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
    ['ADMIN', 'CAJERO'].filter(r => esAdmin || r !== 'ADMIN' || !hayAdmin);

  return (
    <div>
      <h2>Empleados</h2>
      {error && <div style={{ background: '#fee2e2', padding: 10, borderRadius: 6, marginBottom: 10, color: '#b91c1c' }}>{error}</div>}
      {success && <div style={{ background: '#ecfdf5', padding: 10, borderRadius: 6, marginBottom: 10, color: '#065f46' }}>{success}</div>}

      <div style={{ background: 'white', padding: 16, borderRadius: 8, marginBottom: 20 }}>
        <h4>Alta empleado</h4>
        <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input required placeholder="Nombre*" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <input required placeholder="Usuario* (ej: cajero1)" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <div style={{ position: 'relative' }}>
            <input required placeholder="Contraseña*" type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={{ width: '100%', padding: 8, paddingRight: 36, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>{showPassword ? '🙈' : '👁️'}</button>
          </div>
          <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="ADMIN" disabled={hayAdmin}>ADMIN (todo){hayAdmin ? ' — ya existe uno' : ''}</option>
            <option value="CAJERO">CAJERO (POS + ventas)</option>
          </select>
          <button type="submit" style={{ padding: 10, background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Crear empleado</button>
        </form>
        <small style={{ color: '#6b7280' }}>El cajero puede vender y ver stock, pero no accede al Dashboard, Movimientos ni Empleados.</small>
      </div>

      <table style={{ width: '100%', background: 'white', borderRadius: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th style={{ padding: 10 }}>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>
          {empleados.map(emp => (
            <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: emp.activo ? 1 : 0.5 }}>
              <td style={{ padding: 10 }}>{emp.nombre}</td><td>{emp.username || emp.email}</td>
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
          {empleados.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>Sin empleados</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
