import { PROVEEDOR } from '../lib/proveedor';

export default function ContactoProveedor({ compacto = false }: { compacto?: boolean }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        fontSize: compacto ? 12 : 13,
        color: '#374151',
        lineHeight: 1.7,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>¿Dudas? Contactá a {PROVEEDOR.nombre}</div>
      <div>
        📱 WhatsApp/Tel:{' '}
        <a href={`https://wa.me/${PROVEEDOR.telefonoLink}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
          {PROVEEDOR.telefono}
        </a>
      </div>
      <div>
        ✉️ Email:{' '}
        <a href={`mailto:${PROVEEDOR.email}`} style={{ color: '#2563eb' }}>
          {PROVEEDOR.email}
        </a>
      </div>
      <div>
        📸 Instagram:{' '}
        <a href={PROVEEDOR.instagramUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
          {PROVEEDOR.instagram}
        </a>
      </div>
    </div>
  );
}
