import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import { checkUsername, saveLicenseSession } from '../lib/license';

export default function Setup() {
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  // Si ya hay usuarios locales, este panel no debe mostrarse.
  useEffect(() => {
    let activo = true;
    api.get('/auth/has-users')
      .then(({ data }) => {
        if (!activo) return;
        if (data?.hasUsers) navigate('/login', { replace: true });
        else setVerificando(false);
      })
      .catch(() => { if (activo) setVerificando(false); });
    return () => { activo = false; };
  }, [navigate]);

  const checkUser = async (u: string) => {
    const limpio = u.trim();
    if (limpio.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const res = await checkUsername(limpio);
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
      const { data } = await api.post('/auth/setup-inicial', {
        nombreEmpresa: nombreEmpresa.trim(),
        usuario: usuario.trim(),
        password,
        direccion: direccion.trim(),
        telefono: telefono.trim(),
      });
      setAuth(data.access_token, data.user);
      if (data.user.sucursalId) {
        localStorage.setItem('sucursalId', data.user.sucursalId);
      }
      saveLicenseSession(data.license);
      localStorage.setItem('empresa_nombre', nombreEmpresa.trim());
      localStorage.setItem('nombreEmpresa', nombreEmpresa.trim());
      localStorage.setItem('empresa_direccion', direccion.trim());
      localStorage.setItem('empresa_telefono', telefono.trim());
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo completar el registro. Verificá tu conexión a internet.'));
    } finally {
      setLoading(false);
    }
  };

  if (verificando) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f3f4f6' }}>
        <p style={{ color: '#6b7280' }}>Verificando instalación...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f3f4f6', padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: 32, borderRadius: 12, width: 460, maxWidth: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', fontSize: 22, lineHeight: 1.3 }}>Bienvenido/a por favor Registra tu Empresa para comenzar</h1>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', padding: 12, borderRadius: 8, margin: '16px 0', fontSize: 13, lineHeight: 1.5 }}>
          📶 <b>Debés estar conectado a internet para registrarte.</b> Es necesario crear tu usuario en el servidor de licencias para que el proveedor pueda administrar tu suscripción Premium o No Premium.
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}

        <label>Usuario *</label>
        <input
          value={usuario}
          onChange={e => { setUsuario(e.target.value); setUsernameStatus('idle'); }}
          onBlur={e => checkUser(e.target.value)}
          required
          placeholder="Ej: panaderiaelsol"
          autoComplete="off"
          style={{ width: '100%', padding: 10, margin: '6px 0 4px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
        />
        {usernameStatus === 'checking' && <small style={{ color: '#6b7280' }}>Verificando disponibilidad en el servidor de licencias...</small>}
        {usernameStatus === 'available' && <small style={{ color: '#059669' }}>✅ Usuario disponible</small>}
        {usernameStatus === 'taken' && <small style={{ color: '#dc2626' }}>❌ El usuario ya está en uso en el servidor de licencias</small>}

        <label style={{ display: 'block', marginTop: 8 }}>Contraseña *</label>
        <div style={{ position: 'relative', margin: '6px 0 12px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: 10, paddingRight: 40, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} title={showPassword ? 'Ocultar' : 'Mostrar'}>{showPassword ? '🙈' : '👁️'}</button>
        </div>

        <label>Repetir contraseña *</label>
        <input type={showPassword ? 'text' : 'password'} value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repetí la contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

        <label>Nombre de la empresa *</label>
        <input value={nombreEmpresa} onChange={e => setNombreEmpresa(e.target.value)} required placeholder="Ej: Panadería El Sol" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

        <label>Teléfono (opcional)</label>
        <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 1122334455" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

        <label>Dirección (opcional)</label>
        <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. Principal 123" style={{ width: '100%', padding: 10, margin: '6px 0 16px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

        <button type="submit" disabled={loading || usernameStatus === 'taken'} style={{ width: '100%', padding: 12, background: loading || usernameStatus === 'taken' ? '#9ca3af' : '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: loading || usernameStatus === 'taken' ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Registrando...' : 'Registrar empresa y comenzar'}
        </button>

        <small style={{ display: 'block', marginTop: 12, textAlign: 'center', color: '#9ca3af' }}>El nombre de la empresa, teléfono y dirección se pueden editar después en Configuración → Datos de la empresa.</small>
      </form>
    </div>
  );
}
