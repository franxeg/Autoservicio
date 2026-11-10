import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useEffect, useState } from 'react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const rol = user?.rol;

  // Tema reactivo
  const [temaColor, setTemaColor] = useState(() => localStorage.getItem('tema_color') || '#111827');
  const [temaFontSize, setTemaFontSize] = useState(() => localStorage.getItem('tema_fontSize') || '14');
  const [temaModo, setTemaModo] = useState(() => localStorage.getItem('tema_modo') || 'claro');

  const aplicarTema = () => {
    const color = localStorage.getItem('tema_color') || '#111827';
    const fs = localStorage.getItem('tema_fontSize') || '14';
    const modo = localStorage.getItem('tema_modo') || 'claro';
    setTemaColor(color);
    setTemaFontSize(fs);
    setTemaModo(modo);
    document.documentElement.style.setProperty('--color-primario', color);
    document.documentElement.style.setProperty('--font-size-base', fs + 'px');
    if (modo === 'oscuro') document.body.classList.add('tema-oscuro'); else document.body.classList.remove('tema-oscuro');
    // Inyectar estilo global para aplicar color a botones y sidebar
    let styleTag = document.getElementById('tema-global');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'tema-global'; document.head.appendChild(styleTag); }
    styleTag.textContent = `
      :root { --color-primario: ${color}; --font-size-base: ${fs}px; }
      body { font-size: ${fs}px; }
      body.tema-oscuro { background: #1f2937; color: #f9fafb; }
    `;
  };

  useEffect(() => {
    aplicarTema();
    const handler = () => aplicarTema();
    window.addEventListener('storage', handler);
    const interval = setInterval(aplicarTema, 2000);
    return () => { window.removeEventListener('storage', handler); clearInterval(interval); };
  }, []);

  // Nombre de empresa reactivo (solo premium)
  const [nombreEmpresaSidebar, setNombreEmpresaSidebar] = useState('Autoservicio');
  useEffect(() => {
    const update = () => {
      const esPremium = (() => {
        try {
          const cache = localStorage.getItem('license_status_cache');
          if (cache) {
            const parsed = JSON.parse(cache);
            const status = parsed?.status || parsed;
            if (status?.isPremium) return true;
          }
          const trialStart = localStorage.getItem('premium_trial_start');
          if (trialStart) {
            const trialEnd = Number(trialStart) + 30 * 24 * 60 * 60 * 1000;
            if (Date.now() < trialEnd) return true;
          }
          return localStorage.getItem('premium_activo') === 'true';
        } catch { return false; }
      })();
      if (!esPremium) { setNombreEmpresaSidebar('Autoservicio'); return; }
      const name = localStorage.getItem('empresa_nombre') || user?.empresa?.nombre || 'Autoservicio';
      setNombreEmpresaSidebar(name);
    };
    update();
    const interval = setInterval(update, 2000);
    window.addEventListener('storage', update);
    return () => { clearInterval(interval); window.removeEventListener('storage', update); };
  }, [user]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  const linkStyle = (path: string): React.CSSProperties => ({
    color: 'white',
    textDecoration: 'none',
    padding: 8,
    background: isActive(path) ? 'rgba(0,0,0,0.25)' : 'transparent',
    borderRadius: 6,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = rol === 'ADMIN';
  const isRestricted = rol === 'REPOSITOR' || rol === 'ELABORACION';
  const isRepositor = rol === 'REPOSITOR';
  const isElaboracion = rol === 'ELABORACION';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: 240, background: temaColor, color: 'white', padding: 20, display: 'flex', flexDirection: 'column', gap: 8, transition: 'background 0.3s' }}>
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>{nombreEmpresaSidebar}</h2>
        {isAdmin && <Link to="/" style={linkStyle('/')}>📊 Dashboard</Link>}
        {!isRestricted && <Link to="/pos" style={linkStyle('/pos')}>🛒 POS / Ventas</Link>}
        <Link to="/productos" style={linkStyle('/productos')}>📦 Productos</Link>
        <Link to="/stock" style={linkStyle('/stock')}>📋 Stock</Link>
        {isAdmin && <Link to="/compras" style={linkStyle('/compras')}>🚚 Compras/Gastos</Link>}
        {isAdmin && <Link to="/movimientos" style={linkStyle('/movimientos')}>📈 Movimientos</Link>}
        {!isRestricted && <Link to="/clientes" style={linkStyle('/clientes')}>👥 Clientes</Link>}
        {!isRestricted && <Link to="/proveedores" style={linkStyle('/proveedores')}>🏭 Proveedores</Link>}
        {!isElaboracion && <Link to="/caja" style={linkStyle('/caja')}>💰 Caja</Link>}
        {isAdmin && <Link to="/empleados" style={linkStyle('/empleados')}>👷 Empleados</Link>}
        <Link to="/configuracion" style={linkStyle('/configuracion')}>⚙️ Configuración</Link>
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12 }}>
          <small>{user?.nombre || 'Usuario'} - {user?.rol}</small><br />
          <button onClick={handleLogout} style={{ marginTop: 8, width: '100%', padding: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6 }}>Cerrar Sesión</button>
        </div>
      </aside>
      <main style={{ flex: 1, background: '#f9fafb', padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}