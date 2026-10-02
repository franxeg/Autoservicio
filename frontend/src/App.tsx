import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Productos from './pages/Productos';
import Caja from './pages/Caja';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import Stock from './pages/Stock';
import Clientes from './pages/Clientes';
import Empleados from './pages/Empleados';
import Sucursales from './pages/Sucursales';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Proveedor from './pages/Proveedor';
import { useAuthStore } from './lib/store';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupRoute><Setup /></SetupRoute>} />
        <Route path="/proveedor" element={<Proveedor />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="productos" element={<Productos />} />
          <Route path="stock" element={<Stock />} />
          <Route path="compras" element={<Compras />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="proveedores" element={<Proveedores />} />
          <Route path="caja" element={<Caja />} />
          <Route path="empleados" element={<Empleados />} />
          <Route path="sucursales" element={<Sucursales />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
