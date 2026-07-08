import { useState } from 'react'
import { Settings, User, Bell, Shield, CreditCard } from 'lucide-react'
import useAuthStore from '../store/authStore.js'

export default function ConfiguracionPage() {
  const { user } = useAuthStore()
  const [saved, setSaved] = useState(false)
  const [notifs, setNotifs] = useState({ citas: true, resumen: false })

  const handleSaveNotifs = (e) => {
    e.preventDefault()
    // TODO: persistir preferencias de notificación (tabla hrm_preferences)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const displayName = user?.user_metadata?.full_name || '—'
  const email = user?.email || '—'

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Preferencias de tu cuenta</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 560 }}>
        {/* Perfil */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <User size={18} style={{ color: 'var(--md-primary)' }} />
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--md-on-surface)' }}>Perfil</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <InfoRow label="Nombre" value={displayName} />
            <InfoRow label="Correo" value={email} />
            <InfoRow label="ID de usuario" value={user?.id?.slice(0, 8) + '…'} mono />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '1rem' }}>
            Para cambiar nombre o correo, ve a la configuración de tu cuenta en Supabase.
          </p>
        </div>

        {/* Notificaciones */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <Bell size={18} style={{ color: 'var(--md-primary)' }} />
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--md-on-surface)' }}>Notificaciones</h2>
          </div>
          <form onSubmit={handleSaveNotifs} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <Toggle
              label="Recordatorio de citas"
              description="Recibe un aviso antes de cada entrevista agendada"
              checked={notifs.citas}
              onChange={v => setNotifs(n => ({ ...n, citas: v }))}
            />
            <Toggle
              label="Resumen semanal"
              description="Un correo los lunes con tu actividad de la semana"
              checked={notifs.resumen}
              onChange={v => setNotifs(n => ({ ...n, resumen: v }))}
            />
            {saved && <div className="alert alert-success">Preferencias guardadas.</div>}
            <div>
              <button type="submit" className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </form>
        </div>

        {/* Suscripción */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <CreditCard size={18} style={{ color: 'var(--md-primary)' }} />
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--md-on-surface)' }}>Suscripción</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '1rem' }}>
            La suscripción Pro ($299 MXN/mes) desbloquea datos de contacto de todas las reclutadoras del directorio.
          </p>
          <button className="btn btn-primary btn-sm" disabled>
            Actualizar a Pro (próximamente)
          </button>
        </div>

        {/* Privacidad */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Shield size={18} style={{ color: 'var(--md-primary)' }} />
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--md-on-surface)' }}>Privacidad y datos</h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Tratamos tus datos conforme a la <strong>LFPDPPP</strong> (Ley Federal de Protección de Datos Personales en Posesión de Particulares).
            Tienes derechos ARCO (Acceso, Rectificación, Cancelación, Oposición).
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a href="#" className="btn btn-outline btn-sm">Aviso de Privacidad</a>
            <button className="btn btn-danger btn-sm" disabled>Eliminar mi cuenta</button>
          </div>
        </div>
      </div>
    </>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid var(--md-outline-variant)' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', width: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: 'var(--md-on-surface)', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  const id = label.replace(/\s/g, '-').toLowerCase()
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', cursor: 'pointer' }}>
      <div style={{ position: 'relative', flexShrink: 0, marginTop: 2 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 36, height: 20, position: 'absolute', cursor: 'pointer' }}
        />
        <div style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? 'var(--md-primary)' : 'var(--md-outline-variant)',
          transition: 'background 0.2s',
          position: 'relative'
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3, left: checked ? 19 : 3,
            transition: 'left 0.2s'
          }} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--md-on-surface)' }}>{label}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>{description}</p>
      </div>
    </label>
  )
}
