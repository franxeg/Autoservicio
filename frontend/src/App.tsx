import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Productos from './pages/Productos';
import Caja from './pages/Caja';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import Movimientos from './pages/Movimientos';
import Stock from './pages/Stock';
import Clientes from './pages/Clientes';
import Empleados from './pages/Empleados';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Proveedor from './pages/Proveedor';
import { useAuthStore } from './lib/store';

const RESTRICTED_ROLE_PATHS = ['/', '/pos', '/movimientos', '/proveedores', '/clientes', '/empleados'];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  if (!token) return <Navigate to="/login" replace />;
  if (user?.rol === 'SETUP') return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

function SetupRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  if (!token) return <Navigate to="/login" replace />;
  if (user?.rol !== 'SETUP') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// El cajero no puede ver Dashboard, Empleados ni Movimientos: si entra por URL lo mandamos al POS.
// REPOSITOR y ELABORACION también quedan bloqueados en las pantallas restringidas.
function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.rol)) {
    const fallback = user.rol === 'REPOSITOR' || user.rol === 'ELABORACION' ? '/productos' : '/pos';
    return <Navigate to={fallback} replace />;
  }
  if ((user.rol === 'REPOSITOR' || user.rol === 'ELABORACION') && RESTRICTED_ROLE_PATHS.includes(location.pathname)) {
    return <Navigate to="/productos" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupRoute><Setup /></SetupRoute>} />
        <Route path="/proveedor" element={<Proveedor />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<RequireRole roles={['ADMIN']}><Dashboard /></RequireRole>} />
          <Route path="pos" element={<RequireRole roles={['ADMIN', 'CAJERO']}><POS /></RequireRole>} />
          <Route path="productos" element={<Productos />} />
          <Route path="stock" element={<Stock />} />
          <Route path="compras" element={<Compras />} />
          <Route path="movimientos" element={<RequireRole roles={['ADMIN']}><Movimientos /></RequireRole>} />
          <Route path="clientes" element={<RequireRole roles={['ADMIN', 'CAJERO']}><Clientes /></RequireRole>} />
          <Route path="proveedores" element={<RequireRole roles={['ADMIN', 'CAJERO']}><Proveedores /></RequireRole>} />
          <Route path="caja" element={<Caja />} />
          <Route path="empleados" element={<RequireRole roles={['ADMIN']}><Empleados /></RequireRole>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
