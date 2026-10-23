import { useRegisterSW } from 'virtual:pwa-register/react'

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#ffffff',
        color: '#111827',
        padding: '12px 16px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid #e5e7eb',
      }}
    >
      <span>Nouvelle version disponible</span>

      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: '#047857',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 12px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Actualiser
      </button>

      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Fermer"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          color: '#6b7280',
        }}
      >
        ×
      </button>
    </div>
  )
}