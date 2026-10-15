import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const rol = user?.rol;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
  const linkStyle = (path: string): React.CSSProperties => ({
    color: 'white',
    textDecoration: 'none',
    padding: 8,
    background: isActive(path) ? '#1f2937' : 'transparent',
    borderRadius: 6,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // El ADMIN ve todo. El CAJERO ve todo menos Dashboard, Movimientos y Empleados.
  const isAdmin = rol === 'ADMIN';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ width: 240, background: '#111827', color: 'white', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>{user?.empresa?.nombre || 'Autoservicio'}</h2>
        {isAdmin && <Link to="/" style={linkStyle('/')}>📊 Dashboard</Link>}
        <Link to="/pos" style={linkStyle('/pos')}>🛒 POS / Ventas</Link>
        <Link to="/productos" style={linkStyle('/productos')}>📦 Productos</Link>
        <Link to="/stock" style={linkStyle('/stock')}>📋 Stock</Link>
        <Link to="/compras" style={linkStyle('/compras')}>🚚 Compras/Gastos</Link>
        {isAdmin && <Link to="/movimientos" style={linkStyle('/movimientos')}>📈 Movimientos</Link>}
        <Link to="/clientes" style={linkStyle('/clientes')}>👥 Clientes</Link>
        <Link to="/proveedores" style={linkStyle('/proveedores')}>🏭 Proveedores</Link>
        <Link to="/caja" style={linkStyle('/caja')}>💰 Caja</Link>
        {isAdmin && <Link to="/empleados" style={linkStyle('/empleados')}>👷 Empleados</Link>}
        <div style={{ marginTop: 'auto', borderTop: '1px solid #374151', paddingTop: 12 }}>
          <small>{user?.nombre || 'Usuario'} - {user?.rol}</small><br />
          <button onClick={handleLogout} style={{ marginTop: 8, width: '100%', padding: 6, cursor: 'pointer' }}>Cerrar Sesión</button>
        </div>
      </aside>
      <main style={{ flex: 1, background: '#f9fafb', padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
