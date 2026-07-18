import { useState, useEffect } from 'react'
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const WA_SUPPORT = 'https://wa.me/5215658732336'

export default function MembresiaPage() {
  const [billing, setBilling] = useState(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
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
      const r = await hrmAPI.startBundleCheckout()
      window.location.href = r.data.checkoutUrl
    } catch (err) {
      setBillingError(err.response?.data?.error || err.message)
      setCheckoutLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Membresía</h1>
          <p className="page-subtitle">Un solo plan: directorio completo, ATS Checker y LinkedIn Score con IA</p>
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
            <ActivePlan billing={billing} checkoutLoading={checkoutLoading} onRenew={handleSubscribe} billingError={billingError} />
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
          Contacto desbloqueado para los primeros 5 reclutadores · Score ATS y LinkedIn básicos gratis
        </span>
      </div>

      <div style={{ background: 'var(--md-surface-container-low)', borderRadius: 12, padding: '1rem' }}>
        <p style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--md-on-surface)', marginBottom: '0.5rem' }}>
          Plan completo — $99 MXN<span style={{ fontSize: '0.875rem', fontWeight: 400 }}> / 30 días</span>
        </p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
          {[
            'Contacto completo de todas las reclutadoras del directorio',
            'ATS Checker con IA — hasta 5 usos por periodo',
            'LinkedIn Score con IA por industria — hasta 5 usos por periodo',
            'Pago único de 30 días — sin mensualidad automática, pagas de nuevo solo si quieres seguir',
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
          {checkoutLoading ? 'Redirigiendo a Clip…' : 'Obtener el plan por $99 (30 días)'}
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

function ActivePlan({ billing, checkoutLoading, onRenew, billingError }) {
  const periodEnd = billing.current_period_end
    ? new Date(billing.current_period_end)
    : null
  const periodEndLabel = periodEnd
    ? periodEnd.toLocaleDateString('es-MX', { dateStyle: 'long' })
    : null
  const daysRemaining = periodEnd
    ? Math.max(0, Math.ceil((periodEnd - new Date()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span className="chip chip-success">
          <CheckCircle2 size={12} /> Plan activo
        </span>
        {billing.clip_customer_email && (
          <span style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
            {billing.clip_customer_email}
          </span>
        )}
      </div>

      {periodEndLabel && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
          Vence el <strong style={{ color: 'var(--md-on-surface)' }}>{periodEndLabel}</strong>
          {daysRemaining != null && <> — {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} restantes</>}.
          No se renueva sola: si quieres seguir, pagas de nuevo cuando venza.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {billing.atsUsage && (
          <UsageBar label="ATS Checker con IA" used={billing.atsUsage.used} limit={billing.atsUsage.limit} />
        )}
        {billing.linkedinUsage && (
          <UsageBar label="LinkedIn Score con IA" used={billing.linkedinUsage.used} limit={billing.linkedinUsage.limit} />
        )}
      </div>

      {billingError && <BillingError error={billingError} />}

      <div>
        <button className="btn btn-outline btn-sm" onClick={onRenew} disabled={checkoutLoading}>
          {checkoutLoading ? <span className="spinner spinner-sm" /> : <CreditCard size={14} />}
          {checkoutLoading ? 'Redirigiendo…' : 'Renovar / extender 30 días más'}
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '0.5rem' }}>
          Renovar antes de que venza reinicia tu periodo de 30 días y tus usos de IA.
        </p>
      </div>
    </div>
  )
}

function UsageBar({ label, used, limit }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.25rem' }}>
        <span>{label}</span>
        <span>{used}/{limit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--md-surface-container-low)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--md-primary)', borderRadius: 4 }} />
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
