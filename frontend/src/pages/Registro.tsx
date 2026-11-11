import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCompany, loginCompany, isRegistered } from '../lib/license';

export default function Registro() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<'registro' | 'login'>('registro');
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      const res = modo === 'registro'
        ? await registerCompany(nombre, username, password)
        : await loginCompany(username, password);
      if (res.ok) {
        setMsg(res.message);
        setTimeout(() => navigate('/'), 1500);
      } else {
        setError(res.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (isRegistered()) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f9fafb' }}>
        <div style={{ background: 'white', padding: 32, borderRadius: 12, textAlign: 'center' }}>
          <h2>Ya estás registrado</h2>
          <p style={{ color: '#6b7280' }}>Tu sistema está vinculado a una cuenta.</p>
          <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '10px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ir al sistema</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ background: 'white', padding: 32, borderRadius: 12, width: 420, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>Autoservicio</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: 20 }}>
          {modo === 'registro' ? 'Creá tu cuenta y obtené 30 días de prueba gratis' : 'Iniciá sesión en tu cuenta'}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setModo('registro')} style={{ flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer', border: modo === 'registro' ? '2px solid #111827' : '1px solid #d1d5db', background: modo === 'registro' ? '#111827' : 'white', color: modo === 'registro' ? 'white' : '#111827' }}>Registrarse</button>
          <button onClick={() => setModo('login')} style={{ flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer', border: modo === 'login' ? '2px solid #111827' : '1px solid #d1d5db', background: modo === 'login' ? '#111827' : 'white', color: modo === 'login' ? 'white' : '#111827' }}>Iniciar sesión</button>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {modo === 'registro' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Nombre de la empresa
              <input value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Ej: Panadería El Sol" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
            </label>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Usuario
            <input value={username} onChange={e => setUsername(e.target.value)} required placeholder="Ej: panaderiaelsol" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Contraseña
            <input value={password} onChange={e => setPassword(e.target.value)} required type="password" placeholder="Mínimo 6 caracteres" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
          </label>
          <button type="submit" disabled={loading} style={{ padding: 12, background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: loading ? 'wait' : 'pointer', fontSize: 15, marginTop: 8 }}>
            {loading ? 'Procesando...' : (modo === 'registro' ? 'Crear cuenta' : 'Iniciar sesión')}
          </button>
        </form>

        {error && <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 13 }}>{error}</div>}
        {msg && <div style={{ marginTop: 12, padding: 10, background: '#ecfdf5', color: '#059669', borderRadius: 6, fontSize: 13 }}>{msg}</div>}

        <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
          Al registrarte obtenés 30 días de prueba gratis con acceso a todas las funciones Premium.
        </p>
      </div>
    </div>
  );
}