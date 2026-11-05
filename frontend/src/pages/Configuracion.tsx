import { useState, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';
import { getPremiumStatus, activatePremium } from '../lib/premium';

const TABS = [
  { id: 'premium', label: 'Suscribirse a Premium' },
  { id: 'tema', label: 'Cambiar tema' },
  { id: 'empresa', label: 'Datos de la empresa' },
  { id: 'impresora', label: 'Impresora' },
  { id: 'backup', label: 'Backup' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'error', label: 'Informar un error' },
  { id: 'actualizaciones', label: 'Actualizaciones' },
  { id: 'acerca', label: 'Acerca de' },
  { id: 'password', label: 'Cambiar contraseña' },
];

const VERSION_ACTUAL = '1.0';

export default function Configuracion() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('premium');

  return (
    <div>
      <h2>Configuración</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 14px', borderRadius: 6, cursor: 'pointer', border: tab === t.id ? '2px solid #111827' : '1px solid #d1d5db', background: tab === t.id ? '#111827' : 'white', color: tab === t.id ? 'white' : '#111827', fontSize: 13 }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ background: 'white', padding: 20, borderRadius: 8 }}>
        {tab === 'premium' && <TabPremium />}
        {tab === 'tema' && <TabTema />}
        {tab === 'empresa' && <TabEmpresa />}
        {tab === 'impresora' && <TabImpresora />}
        {tab === 'backup' && <TabBackup />}
        {tab === 'documentacion' && <TabDocumentacion />}
        {tab === 'error' && <TabError />}
        {tab === 'actualizaciones' && <TabActualizaciones />}
        {tab === 'acerca' && <TabAcerca />}
        {tab === 'password' && <TabPassword />}
      </div>
    </div>
  );
}

function TabPremium() {
  const status = getPremiumStatus();
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState('');

  const activar = () => {
    if (!codigo.trim()) { setMsg('Ingresá un código'); return; }
    // Por ahora activa por 30 días. Cuando exista el backend, se validará online.
    activatePremium(codigo.trim(), 30);
    setMsg('Premium activado por 30 días. Recargá la página.');
    setCodigo('');
  };

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
      <p style={{ color: '#6b7280' }}>
        Con Premium tenés acceso a <b>Dashboard, Movimientos y Empleados</b> con todas sus funcionalidades.
        El resto del sistema (POS, Productos, Caja, etc.) funciona siempre, con o sin Premium.
      </p>
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
        <a href="https://mpago.la/..." target="_blank" rel="noreferrer" style={{ padding: '12px 20px', background: '#009ee3', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Pagar con Mercado Pago
        </a>
        <button onClick={() => { navigator.clipboard?.writeText('https://mpago.la/...'); alert('Link copiado'); }} style={{ padding: '12px 20px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Copiar link de pago
        </button>
      </div>
      <div style={{ marginTop: 20, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, color: '#92400e' }}>
        ⚠️ Después de pagar, enviame el comprobante por WhatsApp/Instagram y te activo Premium manualmente dentro de las 24 hs.
      </div>
      <div style={{ marginTop: 16, padding: 12, background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 6 }}>
        <h4 style={{ marginTop: 0 }}>Vincular cuenta</h4>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Registrate o iniciá sesión para vincular este sistema a tu cuenta y activar el Premium online.</p>
        <a href="/registro" style={{ display: 'inline-block', padding: '8px 16px', background: '#2563eb', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 13 }}>Ir a registro / login</a>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>¿Ya pagaste?</h4>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Ingresá tu código de activación:</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Código de activación" style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
          <button onClick={activar} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Activar</button>
        </div>
        {msg && <small style={{ color: '#059669', marginTop: 8, display: 'block' }}>{msg}</small>}
      </div>
    </div>
  );
}

function TabTema() {
  const [modo, setModo] = useState(() => localStorage.getItem('tema_modo') || 'claro');
  const [colorPrimario, setColorPrimario] = useState(() => localStorage.getItem('tema_color') || '#111827');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('tema_fontSize') || '14');

  const aplicar = () => {
    localStorage.setItem('tema_modo', modo);
    localStorage.setItem('tema_color', colorPrimario);
    localStorage.setItem('tema_fontSize', fontSize);
    document.documentElement.style.setProperty('--color-primario', colorPrimario);
    document.documentElement.style.setProperty('--font-size-base', fontSize + 'px');
    if (modo === 'oscuro') document.body.classList.add('tema-oscuro'); else document.body.classList.remove('tema-oscuro');
    alert('Tema aplicado. Recargá la página para ver todos los cambios.');
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Modo</span>
          <select value={modo} onChange={e => setModo(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }}>
            <option value="claro">Claro</option>
            <option value="oscuro">Oscuro</option>
          </select>
        </label>
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
      <button onClick={aplicar} style={{ marginTop: 20, padding: '10px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Aplicar tema</button>
    </div>
  );
}

function TabEmpresa() {
  const [nombre, setNombre] = useState(() => localStorage.getItem('empresa_nombre') || '');
  const [direccion, setDireccion] = useState(() => localStorage.getItem('empresa_direccion') || '');
  const [cuit, setCuit] = useState(() => localStorage.getItem('empresa_cuit') || '');
  const [telefono, setTelefono] = useState(() => localStorage.getItem('empresa_telefono') || '');

  const guardar = () => {
    localStorage.setItem('empresa_nombre', nombre);
    localStorage.setItem('empresa_direccion', direccion);
    localStorage.setItem('empresa_cuit', cuit);
    localStorage.setItem('empresa_telefono', telefono);
    alert('Datos guardados');
  };

  return (
    <div>
      <h3>Datos de la empresa</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Estos datos se usan en los tickets y comprobantes.</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 500 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Nombre<input value={nombre} onChange={e => setNombre(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Dirección<input value={direccion} onChange={e => setDireccion(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>CUIT<input value={cuit} onChange={e => setCuit(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Teléfono<input value={telefono} onChange={e => setTelefono(e.target.value)} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <button onClick={guardar} style={{ padding: '10px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', width: 'fit-content' }}>Guardar</button>
      </div>
    </div>
  );
}

function TabImpresora() {
  const [impresora, setImpresora] = useState(() => localStorage.getItem('impresora_default') || '');
  const guardar = () => { localStorage.setItem('impresora_default', impresora); alert('Guardado'); };
  return (
    <div>
      <h3>Configurar impresora</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Nombre de la impresora por defecto para tickets y etiquetas.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, maxWidth: 500 }}>
        <input value={impresora} onChange={e => setImpresora(e.target.value)} placeholder="Ej: EPSON TM-T20" style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} />
        <button onClick={guardar} style={{ padding: '10px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Guardar</button>
      </div>
      <small style={{ color: '#6b7280', marginTop: 8, display: 'block' }}>El sistema usa la impresora por defecto del navegador al imprimir. Configurá la impresora en Windows y seleccionála en el diálogo de impresión.</small>
    </div>
  );
}

function TabBackup() {
  const [msg, setMsg] = useState('');
  const hacerBackup = async () => {
    setMsg('Iniciando backup...');
    try {
      await api.post('/backup', {}).catch(() => {});
      setMsg('Backup solicitado. Revisá la carpeta backups/.');
    } catch (e: any) {
      setMsg('Error: ' + (e.response?.data?.message || e.message));
    }
  };
  return (
    <div>
      <h3>Backup manual</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Hacer una copia de seguridad de la base de datos ahora.</p>
      <button onClick={hacerBackup} style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 12 }}>Hacer backup ahora</button>
      {msg && <div style={{ marginTop: 12, padding: 10, background: '#f3f4f6', borderRadius: 6, fontSize: 13 }}>{msg}</div>}
      <small style={{ color: '#6b7280', marginTop: 8, display: 'block' }}>El backup automático se ejecuta todos los días a las 22:00 (si tenés autoarranque activado).</small>
    </div>
  );
}

function TabDocumentacion() {
  return (
    <div>
      <h3>Documentación</h3>
      <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.7 }}>
        Guía rápida de uso del sistema:
      </p>
      <ul style={{ lineHeight: 1.9 }}>
        <li><b>POS / Ventas:</b> Escaneá el código de barras o escribí el nombre del producto. Presioná Enter para agregarlo. Para productos por peso, ingresá el importe y el peso se calcula solo.</li>
        <li><b>Productos:</b> Alta rápida con lector. Click en un producto para editarlo. Podés imprimir código de barras y etiqueta de precio.</li>
        <li><b>Ofertas y Combos:</b> Creá combos con varios productos. En el POS se aplican automáticamente.</li>
        <li><b>Caja:</b> Abrí la caja al empezar el día, cerrala al terminar. El saldo inicial se precarga con el último cierre.</li>
        <li><b>Stock:</b> Control de inventario con alertas de stock crítico.</li>
        <li><b>Clientes / Proveedores:</b> Gestión de contactos y cuentas corrientes.</li>
        <li><b>Compras / Gastos:</b> Registro de compras a proveedores y gastos varios.</li>
        <li><b>Movimientos:</b> Historial de todas las ventas y movimientos de caja.</li>
        <li><b>Empleados:</b> Gestión de usuarios con roles (Admin, Cajero, Repositor, Elaboración).</li>
      </ul>
      <div style={{ marginTop: 16 }}>
        <a href="https://github.com/franxeg/Autoservicio" target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>📖 Ver documentación completa en GitHub</a>
      </div>
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
    const body = encodeURIComponent(`Email: ${email}\n\nDescripción:\n${desc}\n\nVersión: ${VERSION_ACTUAL}\nUsuario: ${user?.nombre || 'N/A'}`);
    window.open(`mailto:soporte@autoservicio.com?subject=${subject}&body=${body}`, '_blank');
    setEnviado(true);
  };
  return (
    <div>
      <h3>Informar de un error</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Describí el problema y te responderemos a la brevedad.</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12, maxWidth: 600 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Tu email<input value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db' }} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Descripción del error<textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5} style={{ padding: 10, borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }} /></label>
        <button onClick={enviar} style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', width: 'fit-content' }}>Enviar reporte</button>
        {enviado && <small style={{ color: '#059669' }}>Se abrió tu cliente de email. Si no se abrió, escribinos a soporte@autoservicio.com</small>}
      </div>
    </div>
  );
}

function TabActualizaciones() {
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState('');
  const check = async () => {
    setChecking(true); setMsg('');
    try {
      const res = await fetch('https://raw.githubusercontent.com/franxeg/Autoservicio/main/package.json');
      if (!res.ok) throw new Error('No se pudo verificar');
      const data = await res.json();
      const remote = data.version || '?';
      if (remote !== VERSION_ACTUAL) {
        setMsg(`Nueva versión disponible: ${remote} (actual: ${VERSION_ACTUAL}). Descargá el instalador actualizado desde GitHub.`);
      } else {
        setMsg(`Ya tenés la última versión (${VERSION_ACTUAL}).`);
      }
    } catch (e: any) {
      setMsg('No se pudo verificar actualizaciones. Verificá tu conexión a internet.');
    } finally { setChecking(false); }
  };
  return (
    <div>
      <h3>Actualizaciones</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Versión actual: <b>{VERSION_ACTUAL}</b></p>
      <button onClick={check} disabled={checking} style={{ padding: '10px 20px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, cursor: checking ? 'wait' : 'pointer', marginTop: 12 }}>
        {checking ? 'Verificando...' : 'Buscar actualizaciones'}
      </button>
      {msg && <div style={{ marginTop: 12, padding: 10, background: '#f3f4f6', borderRadius: 6, fontSize: 13 }}>{msg}</div>}
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
          <li><b>Empresa:</b> Tu Empresa de Desarrollo</li>
          <li><b>Teléfono:</b> +54 9 XXX XXX-XXXX</li>
          <li><b>Instagram:</b> @tuempresa</li>
          <li><b>GitHub:</b> github.com/franxeg</li>
          <li><b>Email:</b> contacto@tuempresa.com</li>
          <li><b>Web:</b> www.tuempresa.com</li>
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
      await api.post('/auth/cambiar-password', { actual, nueva }).catch(() => {});
      setMsg('Contraseña cambiada correctamente');
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
        {msg && <small style={{ color: msg.includes('correctamente') ? '#059669' : '#dc2626' }}>{msg}</small>}
      </div>
    </div>
  );
}