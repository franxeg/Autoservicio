import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';

export default function Setup() {
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const user = useAuthStore(s => s.user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/setup-admin', { nombre, usuario, password });
      setAuth(data.access_token, data.user);
      if (data.user.sucursalId) {
        localStorage.setItem('sucursalId', data.user.sucursalId);
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
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: 32, borderRadius: 12, width: 380, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center' }}>Bienvenido</h1>
        <p style={{ textAlign: 'center', color: '#6b7280' }}>
          {user?.empresa?.nombre ? `Empresa: ${user.empresa.nombre}` : 'Configurá tu cuenta'}
        </p>
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          Creá tu usuario administrador para controlar el sistema.
        </p>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
        <label>Nombre y apellido</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        <label>Usuario</label>
        <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Ej: juan" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        <label>Contraseña</label>
        <div style={{ position: 'relative', margin: '6px 0 12px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: 10, paddingRight: 40, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} title={showPassword ? 'Ocultar' : 'Mostrar'}>{showPassword ? '🙈' : '👁️'}</button>
        </div>
        <label>Repetir contraseña</label>
        <input type={showPassword ? 'text' : 'password'} value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repetí la contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 20px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Creando...' : 'Crear administrador'}</button>
      </form>
    </div>
  );
}