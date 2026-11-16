import { ReactNode } from 'react';

/**
 * Cartel de confirmación reutilizable.
 * Se usa antes de acciones destructivas (por ejemplo, registrar otra empresa
 * y borrar los datos actuales).
 */
export default function ConfirmDialog({
  open,
  titulo,
  children,
  nota,
  confirmar = 'Aceptar',
  cancelar = 'Cancelar',
  onConfirm,
  onCancel,
  procesando = false,
}: {
  open: boolean;
  titulo: string;
  children: ReactNode;
  nota?: ReactNode;
  confirmar?: string;
  cancelar?: string;
  onConfirm: () => void;
  onCancel: () => void;
  procesando?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: 24,
      }}
      onClick={() => { if (!procesando) onCancel(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 24,
          width: 440,
          maxWidth: '100%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>{titulo}</h3>
        <div style={{ color: '#374151', fontSize: 14, lineHeight: 1.6 }}>{children}</div>
        {nota && (
          <div
            style={{
              marginTop: 14,
              padding: 10,
              borderRadius: 6,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e3a8a',
              fontSize: 12.5,
              lineHeight: 1.5,
            }}
          >
            {nota}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={procesando}
            style={{
              padding: '10px 16px',
              background: '#e5e7eb',
              color: '#111827',
              border: 'none',
              borderRadius: 6,
              cursor: procesando ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelar}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={procesando}
            style={{
              padding: '10px 16px',
              background: '#b91c1c',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: procesando ? 'wait' : 'pointer',
              opacity: procesando ? 0.7 : 1,
            }}
          >
            {procesando ? 'Procesando...' : confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
