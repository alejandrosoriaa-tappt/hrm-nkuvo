import { useState, useEffect } from 'react'
import { CreditCard, MessageCircle, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const WA_SUPPORT = 'https://wa.me/5215658732336'

export default function MembresiaPage() {
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

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Membresía</h1>
          <p className="page-subtitle">Gestiona tu plan y desbloquea contacto ilimitado con reclutadoras</p>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        <div className="card">
          {billingLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
              <div className="spinner spinner-sm" />
            </div>
          ) : billingError && !billing ? (
            <BillingError error={billingError} />
          ) : billing?.isActive ? (
            <ActivePlan billing={billing} cancelLoading={cancelLoading} cancelDone={cancelDone} onCancel={handleCancel} />
          ) : billing?.status === 'past_due' ? (
            <PastDuePlan billing={billing} checkoutLoading={checkoutLoading} onSubscribe={handleSubscribe} billingError={billingError} />
          ) : (
            <FreePlan checkoutLoading={checkoutLoading} onSubscribe={handleSubscribe} billingError={billingError} />
          )}
        </div>
      </div>
    </>
  )
}

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
