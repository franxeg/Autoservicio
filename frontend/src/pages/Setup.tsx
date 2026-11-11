import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import { registerCompany, checkUsername } from '../lib/license';

export default function Setup() {
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [cuit, setCuit] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  const checkUser = async (u: string) => {
    if (u.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const res = await checkUsername(u);
    setUsernameStatus(res.available ? 'available' : 'taken');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return; }
    if (usernameStatus === 'taken') { setError('El usuario ya está en uso. Elegí otro.'); return; }
    setLoading(true);
    try {
      // 1) Crear empresa/sucursal/admin local
      const { data } = await api.post('/auth/setup-inicial', {
        nombreEmpresa, nombre, usuario, password, cuit, direccion, telefono,
      });
      setAuth(data.access_token, data.user);
      if (data.user.sucursalId) {
        localStorage.setItem('sucursalId', data.user.sucursalId);
      }
      // Guardar datos de empresa en localStorage para tickets/sidebar
      localStorage.setItem('empresa_nombre', nombreEmpresa);
      if (direccion) localStorage.setItem('empresa_direccion', direccion);
      if (cuit) localStorage.setItem('empresa_cuit', cuit);
      if (telefono) localStorage.setItem('empresa_telefono', telefono);

      // 2) Registrar en license-server (si hay conexión)
      try {
        await registerCompany(nombreEmpresa, usuario, password);
      } catch {
        // Si falla (sin internet), se puede registrar después desde Configuración
      }

      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear el administrador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f3f4f6' }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: 32, borderRadius: 12, width: 420, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center' }}>Bienvenido</h1>
        <p style={{ textAlign: 'center', color: '#6b7280' }}>Configurá tu empresa y usuario administrador</p>
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Completá los datos para empezar a usar el sistema.
        </p>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}

        <label>Nombre de la empresa *</label>
        <input value={nombreEmpresa} onChange={e => setNombreEmpresa(e.target.value)} required placeholder="Ej: Panadería El Sol" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

        <label>Nombre y apellido *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Ej: Juan Pérez" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

        <label>Usuario * (para iniciar sesión y administrar)</label>
        <input value={usuario} onChange={e => { setUsuario(e.target.value); checkUser(e.target.value); }} required placeholder="Ej: panaderiaelsol" style={{ width: '100%', padding: 10, margin: '6px 0 4px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        {usernameStatus === 'checking' && <small style={{ color: '#6b7280' }}>Verificando...</small>}
        {usernameStatus === 'available' && <small style={{ color: '#059669' }}>✅ Usuario disponible</small>}
        {usernameStatus === 'taken' && <small style={{ color: '#dc2626' }}>❌ El usuario ya está en uso</small>}

        <label style={{ marginTop: 8 }}>Contraseña *</label>
        <div style={{ position: 'relative', margin: '6px 0 12px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: 10, paddingRight: 40, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} title={showPassword ? 'Ocultar' : 'Mostrar'}>{showPassword ? '🙈' : '👁️'}</button>
        </div>
        <label>Repetir contraseña *</label>
        <input type={showPassword ? 'text' : 'password'} value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repetí la contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>Datos opcionales</summary>
          <div style={{ marginTop: 8 }}>
            <label>CUIT</label>
            <input value={cuit} onChange={e => setCuit(e.target.value)} placeholder="Ej: 20-12345678-9" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <label>Dirección</label>
            <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. Principal 123" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <label>Teléfono</label>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 1122334455" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          </div>
        </details>

        <button type="submit" disabled={loading || usernameStatus === 'taken'} style={{ width: '100%', padding: 12, background: loading || usernameStatus === 'taken' ? '#9ca3af' : '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: loading || usernameStatus === 'taken' ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Creando...' : 'Crear administrador'}</button>
      </form>
    </div>
  );
}