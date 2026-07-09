import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Bell, Shield, CreditCard, MessageCircle, ChevronRight, Phone } from 'lucide-react'
import useAuthStore from '../store/authStore.js'

const WA_SUPPORT = 'https://wa.me/5215658732336'

/** Solo dígitos; para validar longitud del celular MX. */
function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '')
}

/**
 * Acepta 10 dígitos nacionales o formas con 52/521.
 * (Misma idea que normalizeMexicoPhone del backend.)
 */
function isValidMexicoPhone(value) {
  const d = digitsOnly(value)
  if (d.length === 10) return true
  if (d.length === 12 && d.startsWith('52')) return true
  if (d.length === 13 && d.startsWith('521')) return true
  if (d.length === 11 && d.startsWith('1')) return true
  return false
}

export default function ConfiguracionPage() {
  const { user, updateUserMetadata } = useAuthStore()
  const [notifSaved, setNotifSaved] = useState(false)
  const [notifs, setNotifs] = useState({ citas: true, resumen: false })

  const [telefono, setTelefono] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneError, setPhoneError] = useState(null)
  const [phoneSuccess, setPhoneSuccess] = useState(false)

  // Sincronizar input con metadata del usuario
  useEffect(() => {
    const current = user?.user_metadata?.telefono || ''
    setTelefono(current)
  }, [user?.id, user?.user_metadata?.telefono])

  const handleSaveNotifs = (e) => {
    e.preventDefault()
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 2000)
  }

  const handleSavePhone = async (e) => {
    e.preventDefault()
    setPhoneError(null)
    setPhoneSuccess(false)

    const trimmed = telefono.trim()
    if (!trimmed) {
      setPhoneError('Ingresa tu número celular (10 dígitos).')
      return
    }
    if (!isValidMexicoPhone(trimmed)) {
      setPhoneError('Número no válido. Usa 10 dígitos (ej. 4421234567) o con lada 52.')
      return
    }

    setPhoneSaving(true)
    try {
      const result = await updateUserMetadata({ telefono: trimmed })
      if (!result.success) {
        setPhoneError(result.error || 'No se pudo guardar el teléfono.')
        return
      }
      setPhoneSuccess(true)
      setTimeout(() => setPhoneSuccess(false), 3000)
    } finally {
      setPhoneSaving(false)
    }
  }

  const displayName = user?.user_metadata?.full_name || '—'
  const email = user?.email || '—'
  const savedPhone = user?.user_metadata?.telefono || ''
  const phoneDirty = telefono.trim() !== (savedPhone || '').trim()

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <InfoRow label="Nombre" value={displayName} />
            <InfoRow label="Correo" value={email} />
            <InfoRow label="ID" value={user?.id?.slice(0, 8) + '…'} mono />
          </div>

          {/* Teléfono editable — usado por recordatorios Tappt / WhatsApp */}
          <form onSubmit={handleSavePhone} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Phone size={16} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
              <label htmlFor="perfil-telefono" style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--md-on-surface)' }}>
                Celular (WhatsApp)
              </label>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.5, margin: 0 }}>
              Lo usamos para enviarte recordatorios de citas por WhatsApp.
              Formato: 10 dígitos sin espacios (ej. <code style={{ fontSize: '0.7rem' }}>4421234567</code>).
            </p>
            <div className="input-group" style={{ margin: 0 }}>
              <input
                id="perfil-telefono"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="4421234567"
                value={telefono}
                onChange={e => {
                  setTelefono(e.target.value)
                  setPhoneError(null)
                  setPhoneSuccess(false)
                }}
                disabled={phoneSaving}
              />
            </div>
            {phoneError && (
              <div className="alert alert-error" style={{ fontSize: '0.8125rem' }}>{phoneError}</div>
            )}
            {phoneSuccess && (
              <div className="alert alert-success" style={{ fontSize: '0.8125rem' }}>
                Teléfono guardado. Las próximas citas usarán este número para el recordatorio.
              </div>
            )}
            {!savedPhone && !phoneSuccess && (
              <div className="alert alert-info" style={{ fontSize: '0.8125rem' }}>
                Aún no tienes teléfono en tu perfil. Sin él no se envían recordatorios de citas.
              </div>
            )}
            <div>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={phoneSaving || !phoneDirty}
              >
                {phoneSaving ? 'Guardando…' : 'Guardar teléfono'}
              </button>
            </div>
          </form>

          <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '1.25rem' }}>
            Para cambiar nombre o correo contacta soporte.
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
              description="Recibe un aviso antes de cada entrevista agendada (requiere teléfono guardado)"
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
