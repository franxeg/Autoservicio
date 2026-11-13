import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Proveedor() {
  const [token, setToken] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logueando, setLogueando] = useState(false);

  const [empresas, setEmpresas] = useState<any[] | null>(null);
  const [listError, setListError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [accionId, setAccionId] = useState('');
  const [msg, setMsg] = useState('');
  const [codigos, setCodigos] = useState<Record<string, { code: string; expiry: string }>>({});

  const navigate = useNavigate();

  const headers = (tok = token) => ({ headers: { Authorization: `Bearer ${tok}` } });

  const cargarEmpresas = async (tok = token) => {
    if (!tok) return;
    setListError('');
    setCargando(true);
    try {
      const { data } = await api.get('/auth/proveedor/empresas', headers(tok));
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setToken('');
        setEmpresas(null);
        setLoginError('La sesión de proveedor expiró. Ingresá de nuevo.');
      } else {
        setListError(err.response?.data?.message || 'No se pudieron listar las empresas registradas.');
        setEmpresas([]);
      }
    } finally {
      setCargando(false);
    }
  };

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setMsg('');
    setLogueando(true);
    try {
      const { data } = await api.post('/auth/login-proveedor', { usuario, password });
      setToken(data.access_token);
      setUsuario('');
      setPassword('');
      setEmpresas(null);
      await cargarEmpresas(data.access_token);
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Error al iniciar sesión.');
    } finally {
      setLogueando(false);
    }
  };

  const cerrarSesion = () => {
    setToken('');
    setEmpresas(null);
    setCodigos({});
    setMsg('');
    setListError('');
  };

  const togglePremium = async (company: any) => {
    setMsg('');
    setListError('');
    setAccionId(company.id);
    try {
      const nuevoEstado = !company.isPremium;
      await api.patch(`/auth/proveedor/empresas/${company.id}/premium`, { isPremium: nuevoEstado, days: 30 }, headers());
      setMsg(`${company.username || company.nombre}: Premium ${nuevoEstado ? 'activado' : 'desactivado'}.`);
      await cargarEmpresas();
    } catch (err: any) {
      setListError(err.response?.data?.message || 'No se pudo cambiar el estado Premium.');
    } finally {
      setAccionId('');
    }
  };

  const generarCodigo = async (company: any) => {
    setMsg('');
    setListError('');
    setAccionId(company.id);
    try {
      const { data } = await api.post(`/auth/proveedor/empresas/${company.id}/reset-code`, {}, headers());
      setCodigos(prev => ({
        ...prev,
        [company.id]: { code: data.resetCode, expiry: data.resetCodeExpiry },
      }));
    } catch (err: any) {
      setListError(err.response?.data?.message || 'No se pudo generar el código de contraseña.');
    } finally {
      setAccionId('');
    }
  };

  const formatoFecha = (valor: any) => {
    if (!valor) return '—';
    try { return new Date(valor).toLocaleString(); } catch { return '—'; }
  };

  const estadoPremium = (company: any) => {
    if (!company?.isPremium) return false;
    if (!company.premiumExpiry) return true;
    return new Date(company.premiumExpiry) > new Date();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Panel de proveedor</h1>
          <button onClick={() => navigate('/login')} style={{ padding: '8px 14px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ir al login</button>
        </div>

        {!token ? (
          <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: 380, margin: '40px auto 0' }}>
            <h2 style={{ marginTop: 0 }}>Ingresar como proveedor</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>Este panel es exclusivo del proveedor. Ingresá tus credenciales para continuar.</p>
            {loginError && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{loginError}</div>}
            <form onSubmit={iniciarSesion}>
              <label>Usuario</label>
              <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Usuario de proveedor" autoComplete="off" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <label>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 16px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <button type="submit" disabled={logueando} style={{ width: '100%', padding: 12, background: '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: logueando ? 0.7 : 1 }}>{logueando ? 'Ingresando...' : 'Ingresar'}</button>
            </form>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Empresas registradas</h2>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Usuarios creados al instalar el sistema. Desde cada tarjeta podés administrar Premium y generar un código de recuperación de contraseña.</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => cargarEmpresas()} disabled={cargando} style={{ fontSize: 13, padding: '7px 12px', cursor: 'pointer' }}>{cargando ? 'Actualizando...' : 'Actualizar'}</button>
                <button onClick={cerrarSesion} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}>Cerrar sesión</button>
              </div>
            </div>

            {listError && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{listError}</div>}
            {msg && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{msg}</div>}
            {cargando && empresas === null && <p style={{ color: '#6b7280' }}>Cargando empresas...</p>}
            {empresas !== null && empresas.length === 0 && (
              <div style={{ background: 'white', padding: 24, borderRadius: 12, color: '#6b7280' }}>
                Todavía no hay empresas registradas en el servidor de licencias. Aparecerán acá cuando un cliente complete el registro inicial con conexión a internet.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {(empresas || []).map((c: any) => {
                const premium = estadoPremium(c);
                const trialVigente = !premium && c.trialEnd && new Date(c.trialEnd) > new Date();
                const codigo = codigos[c.id];
                const codigoServidor = !codigo && c.resetCode && c.resetCodeExpiry && new Date(c.resetCodeExpiry) > new Date()
                  ? { code: c.resetCode, expiry: c.resetCodeExpiry }
                  : null;
                const codigoVisible = codigo || codigoServidor;
                return (
                  <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre de usuario</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{c.username || '—'}</div>
                      {c.nombre && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{c.nombre}</div>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, padding: '4px 10px', borderRadius: 999, color: 'white', background: premium ? '#059669' : (trialVigente ? '#d97706' : '#6b7280') }}>
                        {premium ? 'Premium' : (trialVigente ? 'Trial' : 'No premium')}
                      </span>
                      <button
                        onClick={() => togglePremium(c)}
                        disabled={accionId === c.id}
                        style={{ fontSize: 12, padding: '6px 10px', background: premium ? '#dc2626' : '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: accionId === c.id ? 'wait' : 'pointer', opacity: accionId === c.id ? 0.6 : 1 }}
                      >
                        {premium ? 'Desactivar premium' : 'Activar premium'}
                      </button>
                    </div>

                    {premium && <div style={{ fontSize: 12, color: '#6b7280' }}>Vence: {formatoFecha(c.premiumExpiry)}</div>}
                    {!premium && trialVigente && <div style={{ fontSize: 12, color: '#92400e' }}>Trial hasta: {formatoFecha(c.trialEnd)}</div>}

                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                      <button
                        onClick={() => generarCodigo(c)}
                        disabled={accionId === c.id}
                        style={{ width: '100%', fontSize: 13, padding: '8px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: accionId === c.id ? 'wait' : 'pointer', opacity: accionId === c.id ? 0.6 : 1 }}
                      >
                        Generar código de contraseña
                      </button>
                      {codigoVisible && (
                        <div style={{ marginTop: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#1e3a8a' }}>Código para {c.username}</div>
                          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 8, color: '#1e40af' }}>{codigoVisible.code}</div>
                          <div style={{ fontSize: 11, color: '#1e3a8a' }}>Válido hasta {formatoFecha(codigoVisible.expiry)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
