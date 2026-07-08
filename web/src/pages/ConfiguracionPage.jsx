import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, User, Bell, Shield, CreditCard, MessageCircle, ChevronRight } from 'lucide-react'
import useAuthStore from '../store/authStore.js'

const WA_SUPPORT = 'https://wa.me/5215658732336'

export default function ConfiguracionPage() {
  const { user } = useAuthStore()
  const [notifSaved, setNotifSaved] = useState(false)
  const [notifs, setNotifs] = useState({ citas: true, resumen: false })

  const handleSaveNotifs = (e) => {
    e.preventDefault()
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 2000)
  }

  const displayName = user?.user_metadata?.full_name || '—'
  const email       = user?.email || '—'

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Preferencias de tu cuenta</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 560 }}>

        {/* ── Perfil ── */}
        <div className="card">
          <SectionHeader icon={<User size={18} />} title="Perfil" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <InfoRow label="Nombre" value={displayName} />
            <InfoRow label="Correo"  value={email} />
            <InfoRow label="ID"      value={user?.id?.slice(0, 8) + '…'} mono />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '1rem' }}>
            Para cambiar nombre o correo ve a la configuración de Supabase.
          </p>
        </div>

        {/* ── Suscripción ── */}
        <Link to="/app/membresia" className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <span style={{ color: 'var(--md-primary)' }}><CreditCard size={18} /></span>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--md-on-surface)' }}>Membresía</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>Ver tu plan, suscribirte o cancelar</p>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--md-on-surface-variant)' }} />
        </Link>

        {/* ── Notificaciones ── */}
        <div className="card">
          <SectionHeader icon={<Bell size={18} />} title="Notificaciones" />
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
            {notifSaved && <div className="alert alert-success">Preferencias guardadas.</div>}
            <div><button type="submit" className="btn btn-primary btn-sm">Guardar</button></div>
          </form>
        </div>

        {/* ── Privacidad ── */}
        <div className="card">
          <SectionHeader icon={<Shield size={18} />} title="Privacidad y datos" />
          <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '1rem', lineHeight: 1.6 }}>
            Tratamos tus datos conforme a la <strong>LFPDPPP</strong>.
            Tienes derechos ARCO (Acceso, Rectificación, Cancelación, Oposición).
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a href="#" className="btn btn-outline btn-sm">Aviso de Privacidad</a>
            <button className="btn btn-danger btn-sm" disabled>Eliminar mi cuenta</button>
          </div>
        </div>

        {/* ── Soporte ── */}
        <div className="card" style={{ background: 'var(--md-primary-container)', border: '1px solid var(--md-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MessageCircle size={20} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--md-on-primary-container)' }}>
                ¿Necesitas ayuda?
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginTop: '2px' }}>
                Escríbenos por WhatsApp — respondemos en menos de 24 h.
              </p>
            </div>
            <a
              href={WA_SUPPORT}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto', flexShrink: 0 }}
            >
              <MessageCircle size={14} />
              Soporte
            </a>
          </div>
        </div>

      </div>
    </>
  )
}

// ── Helpers de UI ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <span style={{ color: 'var(--md-primary)' }}>{icon}</span>
      <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--md-on-surface)' }}>{title}</h2>
    </div>
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
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 36, height: 20, position: 'absolute', cursor: 'pointer' }} />
        <div style={{ width: 36, height: 20, borderRadius: 10,
          background: checked ? 'var(--md-primary)' : 'var(--md-outline-variant)',
          transition: 'background 0.2s', position: 'relative' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 3, left: checked ? 19 : 3, transition: 'left 0.2s' }} />
        </div>
      </div>
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--md-on-surface)' }}>{label}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>{description}</p>
      </div>
    </label>
  )
}
