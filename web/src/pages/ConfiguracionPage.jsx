import { useState, useEffect } from 'react'
import { Settings, User, Bell, Shield, CreditCard, MessageCircle, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import useAuthStore from '../store/authStore.js'
import { hrmAPI } from '../lib/api.js'

const WA_SUPPORT = 'https://wa.me/5215658732336'

export default function ConfiguracionPage() {
  const { user } = useAuthStore()
  const [notifSaved, setNotifSaved] = useState(false)
  const [notifs, setNotifs] = useState({ citas: true, resumen: false })
  const [billing, setBilling] = useState(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelDone, setCancelDone] = useState(null)
  const [billingError, setBillingError] = useState(null)

  useEffect(() => {
    hrmAPI.getBillingStatus()
      .then(r => setBilling(r.data))
      .catch(e => setBillingError(e.response?.data?.error || e.message))
      .finally(() => setBillingLoading(false))
  }, [])

  const handleSubscribe = async () => {
    setCheckoutLoading(true)
    setBillingError(null)
    try {
      const r = await hrmAPI.startCheckout()
      window.location.href = r.data.checkoutUrl
    } catch (err) {
      setBillingError(err.response?.data?.error || err.message)
      setCheckoutLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('¿Confirmas que quieres cancelar tu suscripción? Tu acceso Pro se mantiene hasta el fin del periodo pagado.')) return
    setCancelLoading(true)
    setBillingError(null)
    try {
      const r = await hrmAPI.cancelSubscription()
      setCancelDone(r.data)
      setBilling(prev => ({ ...prev, cancel_requested_at: new Date().toISOString() }))
    } catch (err) {
      setBillingError(err.response?.data?.error || err.message)
    } finally {
      setCancelLoading(false)
    }
  }

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
        <div className="card">
          <SectionHeader icon={<CreditCard size={18} />} title="Suscripción" />

          {billingLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
              <div className="spinner spinner-sm" />
            </div>
          ) : billingError ? (
            <BillingError error={billingError} />
          ) : billing?.isActive ? (
            <ActivePlan billing={billing} cancelLoading={cancelLoading} cancelDone={cancelDone} onCancel={handleCancel} />
          ) : billing?.status === 'past_due' ? (
            <PastDuePlan billing={billing} checkoutLoading={checkoutLoading} onSubscribe={handleSubscribe} billingError={billingError} />
          ) : (
            <FreePlan checkoutLoading={checkoutLoading} onSubscribe={handleSubscribe} billingError={billingError} />
          )}
        </div>

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

// ── Sub-componentes de billing ──────────────────────────────────────────

function FreePlan({ checkoutLoading, onSubscribe, billingError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className="chip">Plan Gratuito</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
          Contacto desbloqueado para las primeras 5 reclutadoras
        </span>
      </div>

      <div style={{ background: 'var(--md-surface-container-low)', borderRadius: 12, padding: '1rem' }}>
        <p style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--md-on-surface)', marginBottom: '0.5rem' }}>
          Pro — $299 MXN<span style={{ fontSize: '0.875rem', fontWeight: 400 }}>/mes</span>
        </p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
          {[
            'Acceso ilimitado a datos de contacto de todas las reclutadoras',
            'Sin límite en contactos desbloqueados',
            'Cancela cuando quieras — sin penalización',
          ].map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
              {f}
            </li>
          ))}
        </ul>

        {billingError && <BillingError error={billingError} />}

        <button
          className="btn btn-primary w-full"
          onClick={onSubscribe}
          disabled={checkoutLoading}
        >
          {checkoutLoading ? <span className="spinner spinner-sm" /> : <CreditCard size={16} />}
          {checkoutLoading ? 'Redirigiendo a Clip…' : 'Suscribirme por $299/mes'}
        </button>

        <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: '0.625rem', textAlign: 'center' }}>
          Pago procesado de forma segura por{' '}
          <a href="https://clip.mx" target="_blank" rel="noreferrer" style={{ color: 'var(--md-primary)' }}>Clip</a>.
          No guardamos datos de tarjeta.
        </p>
      </div>
    </div>
  )
}

function ActivePlan({ billing, cancelLoading, cancelDone, onCancel }) {
  const periodEnd = billing.current_period_end
    ? new Date(billing.current_period_end).toLocaleDateString('es-MX', { dateStyle: 'long' })
    : null

  const hasCancelRequest = !!billing.cancel_requested_at

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className="chip chip-success">
          <CheckCircle2 size={12} /> Plan Pro Activo
        </span>
        {billing.clip_customer_email && (
          <span style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
            {billing.clip_customer_email}
          </span>
        )}
      </div>

      {periodEnd && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
          Próxima renovación: <strong style={{ color: 'var(--md-on-surface)' }}>{periodEnd}</strong>
          {' '}— se renueva automáticamente cada mes.
        </p>
      )}

      {hasCancelRequest || cancelDone ? (
        <div className="alert alert-info" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Clock size={15} /> Cancelación solicitada
          </div>
          <p style={{ fontSize: '0.8125rem' }}>
            Recibimos tu solicitud. El equipo de NKUVO la procesará en el panel de Clip y
            recibirás confirmación. Tu acceso Pro se mantiene hasta {periodEnd || 'el fin del periodo pagado'}.
          </p>
          <a href={WA_SUPPORT} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
            <MessageCircle size={13} /> Confirmar por WhatsApp
          </a>
        </div>
      ) : (
        <div>
          <button
            className="btn btn-danger btn-sm"
            onClick={onCancel}
            disabled={cancelLoading}
          >
            {cancelLoading ? <span className="spinner spinner-sm" /> : null}
            {cancelLoading ? 'Procesando…' : 'Cancelar suscripción'}
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '0.5rem' }}>
            Al cancelar mantendrás el acceso Pro hasta el fin del periodo pagado. Sin cobros adicionales.
          </p>
        </div>
      )}
    </div>
  )
}

function PastDuePlan({ billing, checkoutLoading, onSubscribe, billingError }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="alert alert-error">
        <AlertCircle size={15} style={{ flexShrink: 0 }} />
        <div>
          <p style={{ fontWeight: 600 }}>Pago pendiente</p>
          <p style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
            El último cobro de tu suscripción no fue exitoso. Actualiza tu método de pago
            suscribiéndote de nuevo.
          </p>
        </div>
      </div>

      {billingError && <BillingError error={billingError} />}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={onSubscribe}
          disabled={checkoutLoading}
        >
          {checkoutLoading ? <span className="spinner spinner-sm" /> : <CreditCard size={14} />}
          Reactivar suscripción
        </button>
        <a href={WA_SUPPORT} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
          <MessageCircle size={14} /> Soporte WhatsApp
        </a>
      </div>
    </div>
  )
}

function BillingError({ error }) {
  return (
    <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} />
      <div>
        <span>{error}</span>
        {' '}
        <a href={WA_SUPPORT} target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
          Contactar soporte →
        </a>
      </div>
    </div>
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
