import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { fechaCorta } from '../lib/fecha';

const TOKEN_STORAGE = 'providerToken';

export default function Proveedor() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_STORAGE) || '');

  // Login de proveedor
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [logueando, setLogueando] = useState(false);

  const [empresas, setEmpresas] = useState<any[] | null>(null);
  const [listError, setListError] = useState('');

  // (Las empresas se registran automáticamente desde el Setup de cada instalación)

  // Cambio de contraseña
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passRepetir, setPassRepetir] = useState('');
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [passOk, setPassOk] = useState('');
  const [passError, setPassError] = useState('');

  // Reset de credenciales de una empresa
  const [reseteandoId, setReseteandoId] = useState('');
  const [resetResultado, setResetResultado] = useState<any | null>(null);
  const [resetEmpresa, setResetEmpresa] = useState<any | null>(null);
  const [resetUsuario, setResetUsuario] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  // Cambio de contraseña del admin de una empresa
  const [passAdminEmpresa, setPassAdminEmpresa] = useState<any | null>(null);
  const [passAdminNueva, setPassAdminNueva] = useState('');
  const [passAdminCambiando, setPassAdminCambiando] = useState(false);
  const [passAdminResultado, setPassAdminResultado] = useState<any | null>(null);

  // Gestión Premium (license server)
  const [lsUrl, setLsUrl] = useState(() => localStorage.getItem('ls_url') || 'https://autoservicio-license-server.onrender.com');
  const [lsToken, setLsToken] = useState(() => localStorage.getItem('ls_token') || '');
  const [lsUser, setLsUser] = useState('admin');
  const [lsPass, setLsPass] = useState('');
  const [lsError, setLsError] = useState('');
  const [lsLoading, setLsLoading] = useState(false);
  const [lsCompanies, setLsCompanies] = useState<any[] | null>(null);
  const [lsMsg, setLsMsg] = useState('');
  const [lsPassCompany, setLsPassCompany] = useState<any | null>(null);
  const [lsPassNueva, setLsPassNueva] = useState('');
  const [lsPassError, setLsPassError] = useState('');
  const [lsPassOk, setLsPassOk] = useState('');

  const navigate = useNavigate();

  const headers = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const cargarEmpresas = async () => {
    setListError('');
    setEmpresas(null);
    try {
      const { data } = await api.get('/auth/empresas', headers());
      setEmpresas(data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem(TOKEN_STORAGE);
        setToken('');
        setLoginError('La sesión de proveedor expiró. Ingresá de nuevo.');
      } else {
        setListError('No se pudieron listar las empresas.');
        setEmpresas([]);
      }
    }
  };

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLogueando(true);
    try {
      const { data } = await api.post('/auth/login-proveedor', { usuario, password });
      localStorage.setItem(TOKEN_STORAGE, data.access_token);
      setToken(data.access_token);
      setUsuario('');
      setPassword('');
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Error al iniciar sesión.');
    } finally {
      setLogueando(false);
    }
  };

  const copiar = (texto: string) => {
    navigator.clipboard?.writeText(texto);
  };

  // Gestión Premium - License Server
  const lsHeaders = () => ({ headers: { Authorization: `Bearer ${lsToken}` } });

  const lsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLsError(''); setLsLoading(true);
    try {
      const res = await fetch(`${lsUrl}/api/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: lsUser, password: lsPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error de login');
      localStorage.setItem('ls_url', lsUrl);
      localStorage.setItem('ls_token', data.access_token);
      setLsToken(data.access_token);
      setLsPass('');
      cargarLsCompanies(data.access_token);
    } catch (err: any) {
      setLsError(err.message || 'No se pudo conectar al license server');
    } finally {
      setLsLoading(false);
    }
  };

  const cargarLsCompanies = async (tok?: string) => {
    const t = tok || lsToken;
    if (!t) return;
    setLsError(''); setLsLoading(true);
    try {
      const res = await fetch(`${lsUrl}/api/admin/companies`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al cargar empresas');
      setLsCompanies(data);
    } catch (err: any) {
      setLsError(err.message || 'No se pudieron cargar las empresas');
      setLsCompanies([]);
    } finally {
      setLsLoading(false);
    }
  };

  const togglePremium = async (company: any) => {
    setLsMsg('');
    try {
      const nuevoEstado = !company.isPremium;
      const res = await fetch(`${lsUrl}/api/admin/companies/${company.id}/premium`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lsToken}` },
        body: JSON.stringify({ isPremium: nuevoEstado, days: 30 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error');
      setLsMsg(`${company.nombre}: Premium ${nuevoEstado ? 'activado' : 'desactivado'}`);
      cargarLsCompanies();
    } catch (err: any) {
      setLsError(err.message || 'Error al cambiar premium');
    }
  };

  const resetLsPassword = async () => {
    if (!lsPassCompany || !lsPassNueva.trim()) { setLsPassError('Ingresá la nueva contraseña'); return; }
    if (lsPassNueva.length < 6) { setLsPassError('Mínimo 6 caracteres'); return; }
    setLsPassError(''); setLsPassOk('');
    try {
      const res = await fetch(`${lsUrl}/api/admin/companies/${lsPassCompany.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lsToken}` },
        body: JSON.stringify({ password: lsPassNueva }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error');
      setLsPassOk(`Contraseña actualizada para ${lsPassCompany.nombre}. Nueva contraseña: ${lsPassNueva}`);
      setLsPassNueva('');
    } catch (err: any) {
      setLsPassError(err.message || 'Error al cambiar contraseña');
    }
  };


  const cerrarSesion = () => {
    localStorage.removeItem(TOKEN_STORAGE);
    setToken('');
    setEmpresas(null);
  };

  const cambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassOk('');
    setPassError('');
    if (passNueva.length < 6) { setPassError('La nueva contraseña debe tener al menos 6 caracteres'); return; }
    if (passNueva !== passRepetir) { setPassError('Las contraseñas nuevas no coinciden'); return; }
    setCambiandoPass(true);
    try {
      const { data } = await api.post('/auth/cambiar-password-proveedor', { passwordActual: passActual, passwordNueva: passNueva }, headers());
      setPassOk(data.mensaje);
      setPassActual('');
      setPassNueva('');
      setPassRepetir('');
    } catch (err: any) {
      setPassError(err.response?.data?.message || 'Error al cambiar la contraseña.');
    } finally {
      setCambiandoPass(false);
    }
  };

  const abrirReset = (empresa: any) => {
    setResetEmpresa((prev: any) => (prev?.id === empresa.id ? null : empresa));
    setResetResultado(null);
    setResetUsuario('');
    setResetPassword('');
  };

  const confirmarReset = async () => {
    if (!resetEmpresa) return;
    setResetResultado(null);
    setReseteandoId(resetEmpresa.id);
    try {
      const { data } = await api.post('/auth/resetear-credenciales', {
        empresaId: resetEmpresa.id,
        usuarioSetup: resetUsuario.trim() || undefined,
        passwordTemporal: resetPassword || undefined,
      }, headers());
      setResetResultado(data);
      setResetUsuario('');
      setResetPassword('');
      setResetEmpresa(null);
      cargarEmpresas();
    } catch (err: any) {
      alert(err.response?.data?.message || 'No se pudo resetear la empresa.');
    } finally {
      setReseteandoId('');
    }
  };

  const abrirPassAdmin = (empresa: any) => {
    setPassAdminEmpresa((prev: any) => (prev?.id === empresa.id ? null : empresa));
    setPassAdminResultado(null);
    setPassAdminNueva('');
  };

  const confirmarPassAdmin = async () => {
    if (!passAdminEmpresa) return;
    setPassAdminCambiando(true);
    try {
      const { data } = await api.post('/auth/cambiar-password-admin', {
        empresaId: passAdminEmpresa.id,
        passwordNueva: passAdminNueva.trim() || undefined,
      }, headers());
      setPassAdminResultado(data);
      setPassAdminNueva('');
      setPassAdminEmpresa(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'No se pudo cambiar la contraseña del admin.');
    } finally {
      setPassAdminCambiando(false);
    }
  };

  useEffect(() => {
    if (token) cargarEmpresas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: 24 }}>
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0 }}>Panel de proveedor</h1>
          <button onClick={() => navigate('/login')} style={{ padding: '8px 14px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ir al login</button>
        </div>

        {!token ? (
          <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: 380, margin: '40px auto 0' }}>
            <h2 style={{ marginTop: 0 }}>Ingresar como proveedor</h2>
            {loginError && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{loginError}</div>}
            <form onSubmit={iniciarSesion}>
              <label>Usuario</label>
              <input value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="Usuario de proveedor" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <label>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 16px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <button type="submit" disabled={logueando} style={{ width: '100%', padding: 12, background: '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: logueando ? 0.7 : 1 }}>{logueando ? 'Ingresando...' : 'Ingresar'}</button>
            </form>
          </div>
        ) : (
          <>
            {resetResultado && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 12, borderRadius: 8, marginBottom: 20 }}>
                <strong style={{ color: '#065f46' }}>Accesos de '{resetResultado.empresa.nombre}' reseteados. Credenciales para entregar al cliente:</strong>
                <div style={{ marginTop: 10, fontSize: 14 }}>
                  <div>Usuario temporal: <b>{resetResultado.credenciales.usuario}</b> <button onClick={() => copiar(resetResultado.credenciales.usuario)} style={{ marginLeft: 6, fontSize: 12, cursor: 'pointer' }}>Copiar</button></div>
                  <div style={{ marginTop: 6 }}>Contraseña: <b>{resetResultado.credenciales.password}</b> <button onClick={() => copiar(resetResultado.credenciales.password)} style={{ marginLeft: 6, fontSize: 12, cursor: 'pointer' }}>Copiar</button></div>
                </div>
                <small style={{ color: '#065f46', display: 'block', marginTop: 10 }}>Los usuarios anteriores quedaron bloqueados. El cliente creará un nuevo administrador al ingresar.</small>
              </div>
            )}

            <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: 1, minWidth: 300 }}>
                <h2 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Instalaciones locales <button onClick={cargarEmpresas} style={{ fontSize: 13, padding: '6px 10px', cursor: 'pointer' }}>Actualizar</button></h2>
                <p style={{ color: '#6b7280', fontSize: 13, marginTop: 0 }}>Empresas en la base de datos local de esta instalación (soporte/provisionamiento). La gestión de suscripciones Premium se hace en "Gestión Premium (License Server)".</p>
                {listError && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{listError}</div>}
                {empresas === null && <p style={{ color: '#6b7280' }}>Cargando...</p>}
                {empresas !== null && empresas.length === 0 && <p style={{ color: '#6b7280' }}>Todavía no hay empresas.</p>}
                {empresas !== null && empresas.map((e) => (
                  <div key={e.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{e.nombre}</strong>
                      <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, color: 'white', background: e.configurada ? '#059669' : '#d97706' }}>{e.configurada ? 'Operativa' : 'Pendiente de config'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
                      {e.cuit ? `CUIT ${e.cuit} · ` : ''}{e.usuarios} usuario(s)<br />
                      Admin: <b style={{ color: '#111827' }}>{e.adminUsuario || 'sin admin (pendiente de config)'}</b> · Creada el {fechaCorta(e.createdAt)}
                    </div>
                    {passAdminResultado?.empresa?.id === e.id && (
                      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: 12, borderRadius: 8, marginTop: 10, fontSize: 13 }}>
                        <strong style={{ color: '#065f46' }}>Nueva contraseña del admin (usuario <b>{passAdminResultado.credenciales.usuario}</b>):</strong>
                        <div style={{ marginTop: 8 }}>
                          <b>{passAdminResultado.credenciales.password}</b>
                          <button onClick={() => copiar(passAdminResultado.credenciales.password)} style={{ marginLeft: 8, fontSize: 12, cursor: 'pointer' }}>Copiar</button>
                        </div>
                        <small style={{ color: '#065f46', display: 'block', marginTop: 8 }}>Los demás usuarios no se vieron afectados.</small>
                      </div>
                    )}
                    <div style={{ marginTop: 10 }}>
                      {resetEmpresa?.id === e.id && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 10, textAlign: 'left' }}>
                          <strong style={{ color: '#b91c1c', fontSize: 13 }}>Resetear accesos de '{e.nombre}'</strong>
                          <div style={{ fontSize: 12, color: '#7f1d1d', margin: '6px 0 10px' }}>Se bloquearán todos sus usuarios actuales. Dejá los campos vacíos para autogenerar.</div>
                          <input value={resetUsuario} onChange={e => setResetUsuario(e.target.value)} placeholder="Usuario temporal (opcional)" style={{ width: '100%', padding: 8, marginBottom: 6, borderRadius: 6, border: '1px solid #fca5a5', boxSizing: 'border-box', fontSize: 13 }} />
                          <input value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Contraseña temporal (opcional, mín 4)" style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6, border: '1px solid #fca5a5', boxSizing: 'border-box', fontSize: 13 }} />
                          <div style={{ textAlign: 'right' }}>
                            <button onClick={() => abrirReset(e)} style={{ fontSize: 12, padding: '5px 10px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', marginRight: 6 }}>Cancelar</button>
                            <button onClick={confirmarReset} disabled={reseteandoId === e.id} style={{ fontSize: 12, padding: '5px 10px', background: '#b91c1c', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: reseteandoId === e.id ? 0.6 : 1 }}>{reseteandoId === e.id ? 'Reseteando...' : 'Confirmar reset'}</button>
                          </div>
                        </div>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        {passAdminEmpresa?.id === e.id && (
                          <div style={{ background: '#fbfffe', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12, marginBottom: 10, textAlign: 'left' }}>
                            <strong style={{ color: '#065f46', fontSize: 13 }}>Nueva contraseña del admin de '{e.nombre}'</strong>
                            <div style={{ fontSize: 12, color: '#065f46', margin: '6px 0 10px' }}>Dejá vacío para autogenerar. No se bloquean otros usuarios.</div>
                            <input value={passAdminNueva} onChange={e => setPassAdminNueva(e.target.value)} placeholder="Contraseña nueva (opcional, mín 4)" style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6, border: '1px solid #a7f3d0', boxSizing: 'border-box', fontSize: 13 }} />
                            <div style={{ textAlign: 'right' }}>
                              <button onClick={() => abrirPassAdmin(e)} style={{ fontSize: 12, padding: '5px 10px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', marginRight: 6 }}>Cancelar</button>
                              <button onClick={confirmarPassAdmin} disabled={passAdminCambiando} style={{ fontSize: 12, padding: '5px 10px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: passAdminCambiando ? 0.6 : 1 }}>{passAdminCambiando ? 'Guardando...' : 'Confirmar'}</button>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => abrirPassAdmin(e)}
                          disabled={!e.adminUsuario}
                          title={!e.adminUsuario ? 'Esta empresa todavía no tiene admin' : 'Cambiar la contraseña del ADMIN'}
                          style={{ fontSize: 12, padding: '5px 10px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 6, cursor: 'pointer', opacity: !e.adminUsuario ? 0.5 : 1 }}
                        >{passAdminEmpresa?.id === e.id ? 'Cerrar' : 'Cambiar pass admin'}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button onClick={cerrarSesion} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13 }}>Cerrar sesión de proveedor</button>
            </div>

            <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20 }}>
              <h2 style={{ marginTop: 0 }}>Gestión Premium — Empresas registradas (License Server)</h2>
              <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>Acá aparecen las empresas que los usuarios registraron al instalar/configurar el sistema (cuando hubo conexión con el servidor de licencias). Desde esta lista podés activar o desactivar Premium por empresa.</p>
              <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Ingresá con las credenciales de <b>administrador del License Server</b> (configuradas en el servidor, ej. <code>ADMIN_USER</code>/<code>ADMIN_PASSWORD</code>). No son las credenciales que crea cada cliente para su empresa.</p>

              {!lsToken ? (
                <form onSubmit={lsLogin} style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>URL del License Server<input value={lsUrl} onChange={e => setLsUrl(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Usuario admin (License Server)<input value={lsUser} onChange={e => setLsUser(e.target.value)} placeholder="ADMIN_USER del servidor" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Contraseña (License Server)<input type="password" value={lsPass} onChange={e => setLsPass(e.target.value)} placeholder="ADMIN_PASSWORD del servidor" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                  <button type="submit" disabled={lsLoading} style={{ padding: '10px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', width: 'fit-content' }}>{lsLoading ? 'Conectando...' : 'Conectar'}</button>
                  {lsError && <div style={{ color: '#dc2626', fontSize: 13 }}>{lsError}</div>}
                </form>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ color: '#059669', fontSize: 13 }}>✅ Conectado al license server</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => cargarLsCompanies()} style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>Actualizar</button>
                      <button onClick={() => { localStorage.removeItem('ls_token'); setLsToken(''); setLsCompanies(null); }} style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>Desconectar</button>
                    </div>
                  </div>
                  {lsError && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{lsError}</div>}
                  {lsMsg && <div style={{ color: '#059669', fontSize: 13, marginBottom: 8 }}>{lsMsg}</div>}
                  {lsLoading && <p style={{ color: '#6b7280' }}>Cargando...</p>}
                  {lsCompanies && lsCompanies.length === 0 && <p style={{ color: '#6b7280' }}>No hay empresas registradas en el servidor de licencias. Las empresas aparecen acá cuando se registran desde el Setup (o desde Configuración) con conexión al servidor.</p>}
                  {lsCompanies && lsCompanies.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}><th>Empresa</th><th>Usuario</th><th>Premium</th><th>Vencimiento</th><th>Acciones</th></tr></thead>
                      <tbody>
                        {lsCompanies.map((c: any) => (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td>{c.nombre}</td>
                            <td style={{ fontSize: 11 }}>{c.username || '—'}</td>
                            <td>{c.isPremium ? '✅ Sí' : (new Date() < new Date(c.trialEnd) ? '⏳ Trial' : '❌ No')}</td>
                            <td style={{ fontSize: 11 }}>{c.isPremium ? (c.premiumExpiry ? new Date(c.premiumExpiry).toLocaleDateString() : '—') : new Date(c.trialEnd).toLocaleDateString()}</td>
                            <td style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => togglePremium(c)} style={{ padding: '4px 8px', background: c.isPremium ? '#dc2626' : '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                                {c.isPremium ? 'Desactivar' : 'Activar'}
                              </button>
                              <button onClick={() => { setLsPassCompany(c); setLsPassNueva(''); setLsPassError(''); setLsPassOk(''); }} style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Cambiar pass</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {lsPassCompany && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={() => setLsPassCompany(null)}>
                  <div style={{ background: 'white', padding: 24, borderRadius: 12, width: 400 }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ marginTop: 0 }}>Cambiar contraseña - {lsPassCompany.nombre}</h3>
                    <p style={{ color: '#6b7280', fontSize: 13 }}>Usuario: <b>{lsPassCompany.username}</b></p>
                    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Nueva contraseña<input type="password" value={lsPassNueva} onChange={e => setLsPassNueva(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={resetLsPassword} style={{ flex: 1, padding: 10, background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cambiar</button>
                        <button onClick={() => setLsPassCompany(null)} style={{ padding: '10px 16px', background: '#e5e7eb', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                      {lsPassError && <div style={{ color: '#dc2626', fontSize: 13 }}>{lsPassError}</div>}
                      {lsPassOk && <div style={{ color: '#059669', fontSize: 13 }}>{lsPassOk}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={cambiarPassword} style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginTop: 20 }}>
              <h2 style={{ marginTop: 0 }}>Cambiar contraseña de proveedor</h2>
              {passOk && <div style={{ background: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{passOk}</div>}
              {passError && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{passError}</div>}
              <label>Contraseña actual</label>
              <input type="password" value={passActual} onChange={e => setPassActual(e.target.value)} placeholder="Contraseña actual" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <label>Nueva contraseña</label>
              <input type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <label>Repetir nueva contraseña</label>
              <input type="password" value={passRepetir} onChange={e => setPassRepetir(e.target.value)} placeholder="Repetí la nueva contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 16px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <button type="submit" disabled={cambiandoPass} style={{ padding: '10px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: cambiandoPass ? 0.7 : 1 }}>{cambiandoPass ? 'Guardando...' : 'Cambiar contraseña'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}