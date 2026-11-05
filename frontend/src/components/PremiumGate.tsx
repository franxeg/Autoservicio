import { ReactNode, useState, useEffect } from 'react';
import { getPremiumStatus, refreshPremiumStatus } from '../lib/premium';

interface Props {
  children: ReactNode;
  titulo?: string;
}

export default function PremiumGate({ children, titulo }: Props) {
  const [status, setStatus] = useState(getPremiumStatus());

  useEffect(() => {
    refreshPremiumStatus().then(s => setStatus(s)).catch(() => {});
  }, []);

  if (status.isPremium) return <>{children}</>;

  return (
    <div style={{ position: 'relative', minHeight: 400 }}>
      <div style={{ filter: 'blur(2px)', opacity: 0.3, pointerEvents: 'none' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.6)' }}>
        <div style={{ background: 'white', padding: 32, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
          <h3 style={{ margin: '0 0 8px' }}>Función Premium</h3>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>
            {titulo ? `${titulo} ` : ''}está disponible en el plan Premium.
            Suscribite para acceder a Dashboard, Movimientos y Empleados con todas sus funcionalidades.
          </p>
          <a href="/configuracion" style={{ display: 'inline-block', padding: '12px 24px', background: '#009ee3', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
            Suscribirse a Premium
          </a>
          <div style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
            30 días de prueba gratis al registrarte
          </div>
        </div>
      </div>
    </div>
  );
}