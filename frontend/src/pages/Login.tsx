import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import ContactoProveedor from '../components/ContactoProveedor';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(true);

  // Recuperación de contraseña
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsuario, setForgotUsuario] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [codigo, setCodigo] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

  // Si no hay usuarios locales, el primer paso es registrar la empresa.
  useEffect(() => {
    let activo = true;
    api.get('/auth/has-users')
      .then(({ data }) => {
        if (!activo) return;
        if (!data?.hasUsers) navigate('/setup', { replace: true });
        else setVerificando(false);
      })
      .catch(() => { if (activo) setVerificando(false); });
    return () => { activo = false; };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { usuario, password });
      setAuth(data.access_token, data.user);
      if (data.user.sucursalId) {
        localStorage.setItem('sucursalId', data.user.sucursalId);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const abrirForgot = () => {
    setForgotError('');
    setForgotMsg('');
    setForgotUsuario(usuario.trim());
    setNueva('');
    setRepetir('');
    setCodigo('');
    setShowForgot(true);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMsg('');
    if (!forgotUsuario.trim()) { setForgotError('Ingresá tu nombre de usuario.'); return; }
    if (nueva.length < 6) { setForgotError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (nueva !== repetir) { setForgotError('Las contraseñas no coinciden.'); return; }
    if (!codigo.trim()) { setForgotError('Ingresá el código que te brindó el proveedor.'); return; }
    setForgotLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        usuario: forgotUsuario.trim(),
        passwordNueva: nueva,
        codigo: codigo.trim(),
      });
      setForgotMsg(data?.message || 'Contraseña actualizada correctamente.');
      setUsuario(forgotUsuario.trim());
      setPassword(nueva);
      setNueva('');
      setRepetir('');
      setCodigo('');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setForgotError(Array.isArray(msg) ? msg.join('. ') : (msg || 'No se pudo cambiar la contraseña.'));
    } finally {
      setForgotLoading(false);
    }
  };

  if (verificando) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f3f4f6' }}>
        <p style={{ color: '#6b7280' }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f3f4f6', padding: 24 }}>
      <form onSubmit={handleSubmit} autoComplete="off" style={{ background: 'white', padding: 32, borderRadius: 12, width: 380, maxWidth: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center' }}>Autoservicio</h1>
        <p style={{ textAlign: 'center', color: '#6b7280' }}>Ingresá para continuar</p>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
        <label>Usuario</label>
        <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Ej: admin, cajero1" autoComplete="off" name="autoservicio-usuario" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db' }} />
        <label>Contraseña</label>
        <div style={{ position: 'relative', margin: '6px 0 12px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" name="autoservicio-clave" style={{ width: '100%', padding: 10, paddingRight: 40, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} title={showPassword ? 'Ocultar' : 'Mostrar'}>{showPassword ? '🙈' : '👁️'}</button>
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        <button type="button" onClick={abrirForgot} style={{ width: '100%', marginTop: 10, padding: 8, background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13 }}>Olvidé mi contraseña</button>
        <small style={{ display: 'block', marginTop: 8, textAlign: 'center', color: '#9ca3af' }}>Ingresá con las credenciales que te entregó tu proveedor</small>
      </form>

      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 80, padding: 24 }} onClick={() => setShowForgot(false)}>
          <form onSubmit={handleForgot} onClick={e => e.stopPropagation()} style={{ background: 'white', padding: 24, borderRadius: 12, width: 400, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Olvidé mi contraseña</h3>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>
              Pedile al proveedor un <b>código de 4 dígitos</b> para tu usuario, y elegí una contraseña nueva.
            </p>
            {forgotError && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{forgotError}</div>}
            {forgotMsg && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{forgotMsg}</div>}
            <label>Usuario</label>
            <input value={forgotUsuario} onChange={e => setForgotUsuario(e.target.value)} placeholder="Tu nombre de usuario" autoComplete="off" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <label>Contraseña nueva</label>
            <input type="password" value={nueva} onChange={e => setNueva(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <label>Repetir contraseña</label>
            <input type="password" value={repetir} onChange={e => setRepetir(e.target.value)} placeholder="Repetí la contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
            <label>Código</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="Código de 4 dígitos" style={{ width: '100%', padding: 10, margin: '6px 0 16px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box', letterSpacing: 4, textAlign: 'center', fontSize: 18 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={forgotLoading} style={{ flex: 1, padding: 10, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: forgotLoading ? 0.7 : 1 }}>{forgotLoading ? 'Validando...' : 'Cambiar contraseña'}</button>
              <button type="button" onClick={() => setShowForgot(false)} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cerrar</button>
            </div>
            <ContactoProveedor compacto />
          </form>
        </div>
      )}
    </div>
  );
}
