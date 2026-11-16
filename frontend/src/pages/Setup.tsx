import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import { checkUsername, saveLicenseSession } from '../lib/license';
import ContactoProveedor from '../components/ContactoProveedor';
import ConfirmDialog from '../components/ConfirmDialog';

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
  const [hayDatos, setHayDatos] = useState(false);
  const [empresaActual, setEmpresaActual] = useState('');
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [avisoLicencia, setAvisoLicencia] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reRegistro = searchParams.get('nueva') === '1';
  const setAuth = useAuthStore(s => s.setAuth);

  // Si ya hay usuarios locales, este panel solo se muestra cuando se pidió
  // explícitamente registrar otra empresa (los datos actuales se eliminan).
  useEffect(() => {
    let activo = true;
    api.get('/auth/has-users')
      .then(({ data }) => {
        if (!activo) return;
        const hay = !!data?.hasUsers;
        setEmpresaActual(data?.empresaNombre || '');
        setHayDatos(hay);
        if (hay && !reRegistro) {
          navigate('/login', { replace: true });
          return;
        }
        setVerificando(false);
      })
      .catch(() => { if (activo) setVerificando(false); });
    return () => { activo = false; };
  }, [navigate, reRegistro]);

  const checkUser = async (u: string) => {
    const limpio = u.trim();
    if (limpio.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const res = await checkUsername(limpio);
    setUsernameStatus(res.available ? 'available' : 'taken');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return; }
    if (usernameStatus === 'taken') { setError('El usuario ya está en uso. Elegí otro.'); return; }
    if (hayDatos) {
      // Los datos del formulario ya están validados: pedimos confirmación
      // antes de eliminar la empresa actual.
      setConfirmarBorrado(true);
      return;
    }
    registrar();
  };

  const registrar = async () => {
    setLoading(true);
    setError('');
    setAvisoLicencia('');
    try {
      if (hayDatos) {
        // Identidad de la empresa anterior en el license-server: el backend la
        // marca como inactiva (no la elimina) después de borrar los datos.
        let licencia: { id?: string; username?: string } | null = null;
        try { licencia = JSON.parse(localStorage.getItem('license_company') || 'null'); } catch { licencia = null; }
        const { data: reinicio } = await api.post('/auth/reiniciar-sistema', {
          licenseCompanyId: licencia?.id,
          licenseUsername: licencia?.username,
        });
        if (reinicio?.licenciaDesactivada === false) {
          setAvisoLicencia(
            'No se pudo marcar la empresa anterior como inactiva en el servidor de licencias (revisá la conexión). ' +
            'En el panel del proveedor va a seguir figurando como activa.',
          );
        }
      }
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
      setConfirmarBorrado(false);
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
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: 32, borderRadius: 12, width: 760, maxWidth: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', fontSize: 22, lineHeight: 1.3 }}>Bienvenido/a por favor Registra tu Empresa para comenzar</h1>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', padding: 12, borderRadius: 8, margin: '16px 0', fontSize: 13, lineHeight: 1.5 }}>
          📶 <b>Debés estar conectado a internet para registrarte.</b> Es necesario crear tu usuario en el servidor
        </div>

        {reRegistro && hayDatos && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 12, borderRadius: 8, margin: '0 0 16px', fontSize: 13, lineHeight: 1.5 }}>
            ⚠️ <b>Atención:</b> al registrar una empresa nueva se eliminarán los datos actuales
            {empresaActual ? <> de <b>{empresaActual}</b></> : null} (ventas, stock, productos y usuarios).
            Se guardará una copia de seguridad automática antes de eliminar.
          </div>
        )}

        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
        {avisoLicencia && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
            ⚠️ {avisoLicencia}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0 24px' }}>
          {/* Columna izquierda: Usuario, Contraseña, Teléfono */}
          <div>
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
            <div style={{ minHeight: 18 }}>
              {usernameStatus === 'checking' && <small style={{ color: '#6b7280' }}>Verificando disponibilidad...</small>}
              {usernameStatus === 'available' && <small style={{ color: '#059669' }}>✅ Usuario disponible</small>}
              {usernameStatus === 'taken' && <small style={{ color: '#dc2626' }}>❌ El usuario ya está en uso en el servidor de licencias</small>}
            </div>

            <label style={{ display: 'block', marginTop: 8 }}>Contraseña *</label>
            <div style={{ position: 'relative', margin: '6px 0 12px' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ width: '100%', padding: 10, paddingRight: 40, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} title={showPassword ? 'Ocultar' : 'Mostrar'}>{showPassword ? '🙈' : '👁️'}</button>
            </div>

            <label>Teléfono (opcional)</label>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 1122334455" style={{ width: '100%', padding: 10, margin: '6px 0 0', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          </div>

          {/* Columna derecha: Nombre de la empresa, Repetir contraseña, Dirección */}
          <div>
            <label>Nombre de la empresa *</label>
            <input value={nombreEmpresa} onChange={e => setNombreEmpresa(e.target.value)} required placeholder="Ej: Panadería El Sol" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

            <label>Repetir contraseña *</label>
            <input type={showPassword ? 'text' : 'password'} value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repetí la contraseña" style={{ width: '100%', padding: 10, margin: '6px 0 12px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

            <label>Dirección (opcional)</label>
            <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. Principal 123" style={{ width: '100%', padding: 10, margin: '6px 0 0', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          </div>
        </div>

        <button type="submit" disabled={loading || usernameStatus === 'taken'} style={{ width: '100%', marginTop: 20, padding: 12, background: loading || usernameStatus === 'taken' ? '#9ca3af' : '#111827', color: 'white', border: 'none', borderRadius: 8, cursor: loading || usernameStatus === 'taken' ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Registrando...' : 'Registrar empresa y comenzar'}
        </button>

        <small style={{ display: 'block', marginTop: 12, textAlign: 'center', color: '#9ca3af', lineHeight: 1.6 }}>
          El nombre de la empresa, teléfono y dirección se pueden editar después en Configuración → Datos de la empresa.<br />
          El nombre de usuario es permanente.
        </small>

        <ContactoProveedor />
      </form>

      {reRegistro && (
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{ marginTop: 12, padding: '8px 14px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13 }}
        >
          ← Volver al inicio de sesión
        </button>
      )}

      <ConfirmDialog
        open={confirmarBorrado}
        titulo="Eliminar datos y registrar otra empresa"
        confirmar="Sí, eliminar y registrar"
        procesando={loading}
        onCancel={() => setConfirmarBorrado(false)}
        onConfirm={registrar}
        nota="Antes de eliminar se guarda un respaldo automático en la carpeta de respaldos de la instalación."
      >
        Atención: si continúa con el registro, los datos de <b>{empresaActual || 'la empresa actual'}</b> se
        eliminarán permanentemente y ya no se podrán recuperar. ¿Desea continuar?
      </ConfirmDialog>
    </div>
  );
}
