import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';

export default function Login() {
  const [usuario, setUsuario] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);

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
      if (data.setupPendiente) {
        navigate('/setup');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f3f4f6' }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: 32, borderRadius: 12, width: 380, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center' }}>Autoservicio</h1>
        <p style={{ textAlign: 'center', color: '#6b7280' }}>Ingresá para continuar</p>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
        <label>Usuario</label>
        <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Ej: admin, cajero1" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db' }} />
        <label>Contraseña</label>
        <div style={{ position: 'relative', margin: '6px 0 20px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 10, paddingRight: 40, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} title={showPassword ? 'Ocultar' : 'Mostrar'}>{showPassword ? '🙈' : '👁️'}</button>
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
        <small style={{ display: 'block', marginTop: 12, textAlign: 'center', color: '#9ca3af' }}>Ingresá con las credenciales que te entregó tu proveedor</small>
      </form>
    </div>
  );
}
