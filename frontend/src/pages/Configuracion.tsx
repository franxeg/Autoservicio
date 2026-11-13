import { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import { getPremiumStatus } from '../lib/premium';

const TABS = [
  { id: 'premium', label: 'Suscribirse a Premium' },
  { id: 'tema', label: 'Cambiar tema' },
  { id: 'empresa', label: 'Datos de la empresa' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'error', label: 'Informar un error' },
  { id: 'actualizaciones', label: 'Actualizaciones' },
  { id: 'acerca', label: 'Acerca de' },
  { id: 'password', label: 'Cambiar contraseña' },
];

const VERSION_ACTUAL = '1.0';

function userPrefKey(base: string, userId?: string | null) {
  return userId ? `${base}_${userId}` : base;
}

export default function Configuracion() {
  const [tab, setTab] = useState('premium');

  return (
    <div>
      <h2>Configuración</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20, marginTop: 16 }}>
        <div style={{ background: 'white', padding: 20, borderRadius: 8, minHeight: 400 }}>
          {tab === 'premium' && <TabPremium />}
          {tab === 'tema' && <TabTema />}
          {tab === 'empresa' && <TabEmpresa />}
          {tab === 'documentacion' && <TabDocumentacion />}
          {tab === 'error' && <TabError />}
          {tab === 'actualizaciones' && <TabActualizaciones />}
          {tab === 'acerca' && <TabAcerca />}
          {tab === 'password' && <TabPassword />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 12px', borderRadius: 6, cursor: 'pointer', border: tab === t.id ? '2px solid #111827' : '1px solid #d1d5db', background: tab === t.id ? '#111827' : 'white', color: tab === t.id ? 'white' : '#111827', fontSize: 13, textAlign: 'left', width: '100%' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabPremium() {
  const status = getPremiumStatus();

  return (
    <div>
      <h3>Suscribirse a Premium</h3>
      <div style={{ background: status.isPremium ? '#ecfdf5' : '#fef2f2', border: `1px solid ${status.isPremium ? '#a7f3d0' : '#fecaca'}`, padding: 12, borderRadius: 6, marginBottom: 16 }}>
        {status.isTrial ? (
          <span style={{ color: '#059669' }}>✅ Estás en <b>período de prueba</b>. Te quedan <b>{status.trialDaysLeft} días</b> de Premium.</span>
        ) : status.isPremium ? (
          <span style={{ color: '#059669' }}>✅ Premium activo hasta {status.expiryDate ? new Date(status.expiryDate).toLocaleDateString() : '—'}</span>
        ) : (
          <span style={{ color: '#dc2626' }}>⚠️ Tu período de prueba venció. Suscribite para seguir usando Dashboard, Movimientos y Empleados.</span>
        )}
      </div>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 16, borderRadius: 8, marginTop: 12 }}>
        <h4 style={{ marginTop: 0 }}>Plan Premium - $8.000 ARS / mes</h4>
        <ul style={{ lineHeight: 1.8 }}>
          <li>Dashboard con estadísticas de ventas</li>
          <li>Movimientos detallados</li>
          <li>Gestión de empleados y permisos</li>
          <li>Soporte prioritario</li>
          <li>Actualizaciones gratuitas</li>
        </ul>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="https://mpago.la/1XcoPQc" target="_blank" rel="noreferrer" style={{ padding: '12px 20px', background: '#009ee3', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Pagar con Mercado Pago
        </a>
        <button onClick={() => { navigator.clipboard?.writeText('https://mpago.la/1XcoPQc'); alert('Link copiado'); }} style={{ padding: '12px 20px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Copiar link de pago
        </button>
      </div>
      <div style={{ marginTop: 20, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, color: '#92400e' }}>
        ⚠️ Después de pagar, enviame el comprobante por WhatsApp/Instagram y te activo Premium manualmente dentro de las 24 hs.
      </div>
      <div style={{ marginTop: 16, padding: 12, background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 6 }}>
        <h4 style={{ marginTop: 0 }}>Activación de Premium</h4>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 0 }}>El Premium se activa desde el panel de proveedor una vez confirmado el pago. Si ya pagaste, esperá a que te lo activen (dentro de las 24 hs).</p>
      </div>
    </div>
  );
}

function applyTheme(color: string, fontSize: string) {
  const root = document.documentElement;
  root.style.setProperty('--color-primario', color);
  root.style.setProperty('--font-size-base', fontSize + 'px');
  document.body.classList.remove('tema-oscuro');
  document.body.style.background = '';
  document.body.style.color = '';
  document.body.style.fontSize = fontSize + 'px';
  let styleTag = document.getElementById('tema-global');
  if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'tema-global'; document.head.appendChild(styleTag); }
  styleTag.textContent = `
    :root { --color-primario: ${color}; --font-size-base: ${fontSize}px; }
    body { font-size: ${fontSize}px; }
  `;
}

function TabTema() {
  const { user } = useAuthStore();
  const uid = user?.id || user?.username || null;
  const [colorPrimario, setColorPrimario] = useState(() => localStorage.getItem(userPrefKey('tema_color', uid)) || localStorage.getItem('tema_color') || '#111827');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem(userPrefKey('tema_fontSize', uid)) || localStorage.getItem('tema_fontSize') || '14');
  const [aplicado, setAplicado] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem(userPrefKey('tema_color', uid)) || localStorage.getItem('tema_color') || '#111827';
    const f = localStorage.getItem(userPrefKey('tema_fontSize', uid)) || localStorage.getItem('tema_fontSize') || '14';
    setColorPrimario(c);
    setFontSize(f);
  }, [uid]);

  const aplicar = () => {
    localStorage.setItem(userPrefKey('tema_color', uid), colorPrimario);
    localStorage.setItem(userPrefKey('tema_fontSize', uid), fontSize);
    localStorage.setItem('tema_color', colorPrimario);
    localStorage.setItem('tema_fontSize', fontSize);
    localStorage.removeItem('tema_modo');
    applyTheme(colorPrimario, fontSize);
    window.dispatchEvent(new Event('storage'));
    setAplicado(true);
  };

  const presets = [
    { nombre: 'Clásico', color: '#111827' },
    { nombre: 'Azul', color: '#2563eb' },
    { nombre: 'Verde', color: '#059669' },
    { nombre: 'Violeta', color: '#7c3aed' },
    { nombre: 'Rojo', color: '#dc2626' },
    { nombre: 'Naranja', color: '#ea580c' },
  ];

  return (
    <div>
      <h3>Cambiar tema</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Elegí el color y el tamaño de fuente. Los cambios se aplican al instante y se guardan para tu usuario.</p>
      <div style={{ marginTop: 12, maxWidth: 320 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Tamaño de fuente</span>
          <select value={fontSize} onChange={e => setFontSize(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="12">Pequeña</option>
            <option value="14">Normal</option>
            <option value="16">Grande</option>
            <option value="18">Muy grande</option>
          </select>
        </label>
      </div>
      <div style={{ marginTop: 16 }}>
        <span style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Color primario</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {presets.map(p => (
            <button key={p.nombre} onClick={() => setColorPrimario(p.color)} style={{ padding: '8px 12px', background: p.color, color: 'white', border: colorPrimario === p.color ? '3px solid #000' : 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              {p.nombre}
            </button>
          ))}
          <input type="color" value={colorPrimario} onChange={e => setColorPrimario(e.target.value)} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer' }} />
        </div>
      </div>
      <button onClick={aplicar} style={{ marginTop: 20, padding: '10px 20px', background: colorPrimario, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Aplicar tema</button>
      {aplicado && <small style={{ color: '#059669', marginLeft: 12 }}>Tema guardado y aplicado ✅</small>}
    </div>
  );
}

function TabEmpresa() {
  const { user, token, setAuth } = useAuthStore();
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const n = user?.empresa?.nombre || localStorage.getItem('empresa_nombre') || localStorage.getItem('nombreEmpresa') || '';
    const d = user?.empresa?.direccion || user?.sucursal?.direccion || localStorage.getItem('empresa_direccion') || '';
    const t = user?.empresa?.telefono || user?.sucursal?.telefono || localStorage.getItem('empresa_telefono') || '';
    setNombre(n || ''); setDireccion(d || ''); setTelefono(t || '');
    if (token) {
      api.get('/auth/empresa')
        .then(({ data }) => {
          if (!data) return;
          setNombre(data.nombre || '');
          setDireccion(data.direccion || '');
          setTelefono(data.telefono || '');
        })
        .catch(() => {});
    }
  }, [user, token]);

  const guardar = async () => {
    const n = nombre.trim();
    if (!n) { setError('El nombre de la empresa es obligatorio.'); return; }
    setError('');
    setMsg('');
    setGuardando(true);
    try {
      await api.patch('/auth/empresa', { nombre: n, direccion: direccion.trim(), telefono: telefono.trim() });
      localStorage.setItem('empresa_nombre', n);
      localStorage.setItem('nombreEmpresa', n);
      localStorage.setItem('empresa_direccion', direccion.trim());
      localStorage.setItem('empresa_telefono', telefono.trim());
      try {
        if (user) {
          const updated = {
            ...user,
            empresa: { ...(user.empresa || {}), nombre: n, direccion: direccion.trim(), telefono: telefono.trim() },
          };
          if (token) setAuth(token, updated);
          else localStorage.setItem('user', JSON.stringify(updated));
        }
      } catch {}
      window.dispatchEvent(new Event('storage'));
      setMsg('Datos guardados. Se usarán en el menú e impresiones (para usuarios Premium o en trial).');
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudieron guardar los datos de la empresa.');
    } finally {
      setGuardando(false);
    }
  };

  const esPremium = (typeof window !== 'undefined') ? (localStorage.getItem('premium_activo') === 'true' || localStorage.getItem('license_status_cache')?.includes('"isPremium":true') || !!localStorage.getItem('premium_trial_start')) : false;

  return (
    <div>
      <h3>Editar datos de la empresa</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Estos datos se usan en el menú (Premium) y en los tickets/comprobantes.</p>
      {!esPremium && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13, color: '#92400e' }}>
          ⚠️ La personalización del nombre en el menú lateral y comprobantes está disponible solo para usuarios Premium o en período de prueba (en plan Free se muestra "Autoservicio").
        </div>
      )}
      <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 500 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Nombre de la empresa<input value={nombre} onChange={e => setNombre(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Teléfono<input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 1122334455" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Dirección<input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej: Av. Principal 123" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <button onClick={guardar} disabled={guardando} style={{ padding: '10px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: guardando ? 'wait' : 'pointer', width: 'fit-content', opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        {msg && <small style={{ color: '#059669' }}>{msg}</small>}
        {error && <small style={{ color: '#dc2626' }}>{error}</small>}
      </div>
    </div>
  );
}

function TabDocumentacion() {
  const [contenido, setContenido] = useState('Cargando...');
  useEffect(() => {
    fetch('/documentacion.txt').then(r => r.text()).then(setContenido).catch(() => setContenido('No se pudo cargar la documentación.'));
  }, []);
  return (
    <div>
      <h3>Documentación</h3>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, background: '#f9fafb', padding: 16, borderRadius: 6, maxHeight: 500, overflow: 'auto' }}>{contenido}</pre>
    </div>
  );
}

function TabError() {
  const { user } = useAuthStore();
  const [desc, setDesc] = useState('');
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const enviar = () => {
    if (!desc.trim()) { alert('Describí el error'); return; }
    const subject = encodeURIComponent('Reporte de error - Autoservicio');
    const body = encodeURIComponent(`Email: ${email}\nUsuario: ${user?.nombre || 'N/A'}\nEmpresa: ${user?.empresa?.nombre || 'N/A'}\n\nDescripción:\n${desc}\n\nVersión: ${VERSION_ACTUAL}`);
    window.open(`mailto:jupitertecnologias@gmail.com?subject=${subject}&body=${body}`, '_blank');
    setEnviado(true);
  };
  return (
    <div>
      <h3>Informar de un error</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Describí el problema y te responderemos a la brevedad. El reporte se enviará por email a jupitertecnologias@gmail.com.</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 600 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Tu email<input value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Descripción del error<textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }} /></label>
        <button onClick={enviar} style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', width: 'fit-content' }}>Enviar reporte</button>
        {enviado && <small style={{ color: '#059669' }}>Se abrió tu cliente de email. Si no se abrió, escribinos a jupitertecnologias@gmail.com</small>}
      </div>
    </div>
  );
}

function TabActualizaciones() {
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');
  const [disponible, setDisponible] = useState(false);
  const check = async () => {
    setChecking(true); setMsg(''); setDisponible(false);
    try {
      const res = await fetch('https://raw.githubusercontent.com/franxeg/Autoservicio/main/package.json');
      if (!res.ok) throw new Error('No se pudo verificar');
      const data = await res.json();
      const remote = data.version || '?';
      if (remote !== VERSION_ACTUAL) {
        setDisponible(true);
        setMsg(`Actualización disponible: v${remote} (tu versión: v${VERSION_ACTUAL}). Descargá el nuevo instalador desde GitHub.`);
      } else {
        setDisponible(false);
        setMsg(`Sistema actualizado (v${VERSION_ACTUAL}).`);
      }
    } catch (e: any) {
      setMsg('No se pudo verificar actualizaciones. Verificá tu conexión a internet.');
    } finally { setChecking(false); }
  };
  return (
    <div>
      <h3>Actualizaciones</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Versión actual: <b>v{VERSION_ACTUAL}</b></p>
      <button onClick={check} disabled={checking} style={{ padding: '10px 20px', background: disponible ? '#059669' : '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: checking ? 'wait' : 'pointer', marginTop: 12 }}>
        {checking ? 'Verificando...' : (disponible ? 'Actualización disponible' : 'Sistema actualizado')}
      </button>
      {msg && <div style={{ marginTop: 12, padding: 10, background: disponible ? '#ecfdf5' : '#f3f4f6', borderRadius: 6, fontSize: 13, color: disponible ? '#059669' : '#374151' }}>{msg}</div>}
      {disponible && <div style={{ marginTop: 12 }}><a href="https://github.com/franxeg/Autoservicio/releases" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Descargar actualización</a></div>}
    </div>
  );
}

function TabAcerca() {
  return (
    <div>
      <h3>Acerca de</h3>
      <div style={{ lineHeight: 1.8, marginTop: 12 }}>
        <p><b>Autoservicio</b> - Sistema de gestión para autoservicios y comercios.</p>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Desarrollado por:</p>
        <ul style={{ lineHeight: 1.9 }}>
          <li><b>Empresa:</b> Jupiter Informatica</li>
          <li><b>Teléfono:</b> +54 9 2355 554004</li>
          <li><b>Instagram:</b> @jupiterinformatica</li>
          <li><b>GitHub:</b> github.com/franxeg</li>
          <li><b>Email:</b> jupitertecnologias@gmail.com</li>
          <li><b>Web:</b> https://franxeg.github.io/Web-design</li>
        </ul>
        <p style={{ color: '#6b7280', fontSize: 12, marginTop: 16 }}>© 2026 - Todos los derechos reservados.</p>
      </div>
    </div>
  );
}

function TabPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [msg, setMsg] = useState('');
  const cambiar = async () => {
    if (!nueva || nueva !== confirmar) { setMsg('Las contraseñas no coinciden'); return; }
    if (nueva.length < 4) { setMsg('La contraseña debe tener al menos 4 caracteres'); return; }
    try {
      const res = await api.post('/auth/cambiar-password', { passwordActual: actual, passwordNueva: nueva });
      setMsg(res.data?.message || 'Contraseña actualizada correctamente');
      const token = localStorage.getItem('license_token');
      const lsUrl = localStorage.getItem('ls_url') || 'https://autoservicio-license-server.onrender.com';
      if (token) {
        try {
          await fetch(`${lsUrl}/api/license/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva }),
          });
        } catch {}
      }
      setActual(''); setNueva(''); setConfirmar('');
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Error al cambiar contraseña');
    }
  };
  return (
    <div>
      <h3>Cambiar contraseña</h3>
      <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 400 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Contraseña actual<input type="password" value={actual} onChange={e => setActual(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Nueva contraseña<input type="password" value={nueva} onChange={e => setNueva(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Confirmar nueva<input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <button onClick={cambiar} style={{ padding: '10px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', width: 'fit-content' }}>Cambiar</button>
        {msg && <small style={{ color: msg.includes('correctamente') || msg.includes('actualizada') ? '#059669' : '#dc2626' }}>{msg}</small>}
      </div>
    </div>
  );
}
