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
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);

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

  const toggleTrial = async (company: any) => {
    setMsg('');
    setListError('');
    setAccionId(company.id);
    try {
      const activo = !estadoTrial(company);
      await api.patch(`/auth/proveedor/empresas/${company.id}/trial`, { activo }, headers());
      setMsg(
        `${company.username || company.nombre}: ${activo ? 'período de prueba reiniciado (30 días)' : 'período de prueba finalizado (plan Free)'}.`,
      );
      await cargarEmpresas();
    } catch (err: any) {
      setListError(err.response?.data?.message || 'No se pudo cambiar el período de prueba.');
    } finally {
      setAccionId('');
    }
  };

  const toggleActivo = async (company: any) => {
    setMsg('');
    setListError('');
    setAccionId(company.id);
    try {
      const activo = company.activo === false;
      await api.patch(`/auth/proveedor/empresas/${company.id}/activo`, { activo }, headers());
      setMsg(`${company.username || company.nombre}: ${activo ? 'empresa reactivada' : 'empresa desactivada'}.`);
      await cargarEmpresas();
    } catch (err: any) {
      setListError(err.response?.data?.message || 'No se pudo cambiar el estado de la empresa.');
    } finally {
      setAccionId('');
    }
  };

  const toggleArchivar = async (company: any) => {
    setMsg('');
    setListError('');
    setAccionId(company.id);
    try {
      const archivada = !company.archivada;
      await api.patch(`/auth/proveedor/empresas/${company.id}/archivar`, { archivada }, headers());
      setMsg(
        `${company.username || company.nombre}: ${archivada ? 'empresa archivada (se oculta del listado)' : 'empresa desarchivada'}.`,
      );
      await cargarEmpresas();
    } catch (err: any) {
      setListError(err.response?.data?.message || 'No se pudo archivar la empresa.');
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

  const estadoTrial = (company: any) => {
    if (estadoPremium(company)) return false;
    return !!company?.trialEnd && new Date(company.trialEnd) > new Date();
  };

  // Orden: premium vigente, trial vigente y free. Dentro de cada grupo se
  // respeta el orden del servidor (más nueva primero).
  const rango = (company: any) => (estadoPremium(company) ? 0 : (estadoTrial(company) ? 1 : 2));

  const todas = empresas || [];
  const archivadas = todas.filter((c: any) => c.archivada).length;
  const visibles = todas
    .filter((c: any) => mostrarArchivadas || !c.archivada)
    .sort((a: any, b: any) => rango(a) - rango(b));

  const badge = (texto: string, color: string, fondo: string) => (
    <span style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, color, background: fondo, fontWeight: 600 }}>
      {texto}
    </span>
  );

  const botonSecundario = (texto: string, onClick: () => void, color = '#111827', deshabilitado = false) => (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      style={{
        fontSize: 12,
        padding: '6px 10px',
        background: 'white',
        color,
        border: `1px solid ${color}33`,
        borderRadius: 6,
        cursor: deshabilitado ? 'wait' : 'pointer',
        opacity: deshabilitado ? 0.6 : 1,
      }}
    >
      {texto}
    </button>
  );

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>Empresas registradas</h2>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>Usuarios creados al instalar el sistema. Desde cada tarjeta podés administrar Premium, el período de prueba (para ver cómo funciona el plan Free), el estado de la empresa y generar un código de recuperación de contraseña.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, userSelect: 'none' }}>
                  <input type="checkbox" checked={mostrarArchivadas} onChange={e => setMostrarArchivadas(e.target.checked)} />
                  Mostrar archivadas{archivadas > 0 ? ` (${archivadas})` : ''}
                </label>
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
            {empresas !== null && empresas.length > 0 && visibles.length === 0 && (
              <div style={{ background: 'white', padding: 24, borderRadius: 12, color: '#6b7280' }}>
                No hay empresas para mostrar.
                {archivadas > 0 ? ` Hay ${archivadas} archivada(s): activá "Mostrar archivadas" para verlas.` : ''}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {visibles.map((c: any) => {
                const premium = estadoPremium(c);
                const trialVigente = estadoTrial(c);
                const activa = c.activo !== false;
                const codigo = codigos[c.id];
                const codigoServidor = !codigo && c.resetCode && c.resetCodeExpiry && new Date(c.resetCodeExpiry) > new Date()
                  ? { code: c.resetCode, expiry: c.resetCodeExpiry }
                  : null;
                const codigoVisible = codigo || codigoServidor;
                const ocupada = accionId === c.id;
                return (
                  <div
                    key={c.id}
                    style={{
                      background: 'white',
                      borderRadius: 12,
                      padding: 18,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      border: activa ? '1px solid transparent' : '1px solid #fecaca',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre de usuario</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{c.username || '—'}</div>
                      {c.nombre && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{c.nombre}</div>}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {premium
                        ? badge('Premium', 'white', '#059669')
                        : trialVigente
                          ? badge('Trial', 'white', '#d97706')
                          : badge('Free', '#374151', '#e5e7eb')}
                      {activa
                        ? badge('Activa', '#065f46', '#d1fae5')
                        : badge('Inactiva', '#991b1b', '#fee2e2')}
                      {c.archivada && badge('Archivada', '#4b5563', '#f3f4f6')}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => togglePremium(c)}
                        disabled={ocupada}
                        style={{ fontSize: 12, padding: '6px 10px', background: premium ? '#dc2626' : '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: ocupada ? 'wait' : 'pointer', opacity: ocupada ? 0.6 : 1 }}
                      >
                        {premium ? 'Desactivar premium' : 'Activar premium'}
                      </button>
                      {botonSecundario(activa ? 'Desactivar' : 'Reactivar', () => toggleActivo(c), activa ? '#991b1b' : '#065f46', ocupada)}
                      {!premium &&
                        botonSecundario(
                          trialVigente ? 'Finalizar trial' : 'Reiniciar trial',
                          () => toggleTrial(c),
                          trialVigente ? '#92400e' : '#1d4ed8',
                          ocupada,
                        )}
                    </div>

                    {premium && <div style={{ fontSize: 12, color: '#6b7280' }}>Vence: {formatoFecha(c.premiumExpiry)}</div>}
                    {!premium && trialVigente && <div style={{ fontSize: 12, color: '#92400e' }}>Trial hasta: {formatoFecha(c.trialEnd)}</div>}
                    {!activa && <div style={{ fontSize: 12, color: '#991b1b' }}>Los datos de esta empresa se eliminaron (registro de otra empresa).</div>}

                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                      <button
                        onClick={() => generarCodigo(c)}
                        disabled={ocupada}
                        style={{ width: '100%', fontSize: 13, padding: '8px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: ocupada ? 'wait' : 'pointer', opacity: ocupada ? 0.6 : 1 }}
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

                    <button
                      onClick={() => toggleArchivar(c)}
                      disabled={ocupada}
                      style={{ background: 'none', border: 'none', color: '#6b7280', cursor: ocupada ? 'wait' : 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0, alignSelf: 'flex-start' }}
                    >
                      {c.archivada ? 'Desarchivar' : 'Archivar'}
                    </button>
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
