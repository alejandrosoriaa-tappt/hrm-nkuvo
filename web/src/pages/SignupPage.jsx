import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, CheckCircle2, CreditCard } from 'lucide-react'
import useAuthStore from '../store/authStore.js'
import AtsExplainerPanel from '../components/AtsExplainerPanel.jsx'
import { hrmAPI } from '../lib/api.js'

export default function SignupPage() {
  const { signUp, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '', apellidoPaterno: '', apellidoMaterno: '',
    telefono: '', email: '', password: '', confirm: ''
  })
  const [success, setSuccess] = useState(false)
  const [showPlans, setShowPlans] = useState(false)
  const [planLoading, setPlanLoading] = useState(null)
  const [planError, setPlanError] = useState(null)

  const goToPlan = async (which) => {
    setPlanError(null)
    if (which === 'free') {
      navigate('/app')
      return
    }
    setPlanLoading(which)
    try {
      const r = await hrmAPI.startBundleCheckout()
      window.location.href = r.data.checkoutUrl
    } catch (err) {
      setPlanError(err.response?.data?.error || err.message)
      setPlanLoading(null)
    }
  }

  const set = (field) => (e) => {
    clearError()
    setForm(f => ({ ...f, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      useAuthStore.setState({ error: 'Las contraseñas no coinciden' })
      return
    }
    const fullName = [form.nombre, form.apellidoPaterno, form.apellidoMaterno].filter(Boolean).join(' ')
    const result = await signUp(form.email, form.password, {
      fullName,
      nombre: form.nombre,
      apellidoPaterno: form.apellidoPaterno,
      apellidoMaterno: form.apellidoMaterno,
      telefono: form.telefono,
    })
    if (result.success) {
      if (result.needsEmailConfirmation) {
        setSuccess(true)
      } else {
        setShowPlans(true)
      }
    }
  }

  if (showPlans) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 620 }}>
          <div className="auth-logo" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <p className="auth-logo-text">HRM <span>NKUVO</span></p>
            <p className="auth-tagline">Cuenta creada — elige cómo empezar</p>
          </div>

          {planError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{planError}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <PlanCard
              title="Gratis"
              price="$0"
              features={['Contacto desbloqueado para los primeros 5 reclutadores', 'ATS Checker y LinkedIn Score: score y diagnóstico']}
              cta="Continuar gratis"
              loading={planLoading === 'free'}
              onClick={() => goToPlan('free')}
              variant="outline"
            />
            <PlanCard
              title="Plan completo"
              price="$99 MXN / 30 días"
              features={['Contacto ilimitado con todos los reclutadores', 'ATS Checker con IA — hasta 5 usos', 'LinkedIn Score con IA por industria — hasta 5 usos', 'Pago único: pagas de nuevo solo si quieres seguir']}
              cta="Obtener el plan por $99"
              loading={planLoading === 'bundle'}
              onClick={() => goToPlan('bundle')}
              variant="primary"
              highlight
            />
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', textAlign: 'center', marginTop: '1rem' }}>
            Puedes cambiar de plan cuando quieras desde Membresía.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
          <h2 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--md-on-surface)' }}>
            Revisa tu correo
          </h2>
          <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Te enviamos un enlace de confirmación a <strong>{form.email}</strong>.
            Ábrelo para activar tu cuenta.
          </p>
          <Link to="/login" className="btn btn-primary w-full">Ir al login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <AtsExplainerPanel />
      <div className="auth-card">
        <div className="auth-logo">
          <p className="auth-logo-text">HRM <span>NKUVO</span></p>
          <p className="auth-tagline">Crea tu cuenta gratuita</p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="nombre">Nombre(s)</label>
            <input
              id="nombre"
              type="text"
              className="input"
              placeholder="María"
              value={form.nombre}
              onChange={set('nombre')}
              autoComplete="given-name"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label" htmlFor="apellidoPaterno">Apellido paterno</label>
              <input
                id="apellidoPaterno"
                type="text"
                className="input"
                placeholder="González"
                value={form.apellidoPaterno}
                onChange={set('apellidoPaterno')}
                autoComplete="family-name"
                required
              />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label className="input-label" htmlFor="apellidoMaterno">Apellido materno</label>
              <input
                id="apellidoMaterno"
                type="text"
                className="input"
                placeholder="Ramírez"
                value={form.apellidoMaterno}
                onChange={set('apellidoMaterno')}
                autoComplete="additional-name"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="telefono">Número celular</label>
            <input
              id="telefono"
              type="tel"
              className="input"
              placeholder="442 123 4567"
              value={form.telefono}
              onChange={set('telefono')}
              autoComplete="tel"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={form.email}
              onChange={set('email')}
              autoComplete="email"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="confirm">Confirmar contraseña</label>
            <input
              id="confirm"
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isLoading}
            style={{ marginTop: '0.5rem' }}
          >
            {isLoading ? <span className="spinner spinner-sm" /> : <UserPlus size={16} />}
            Crear cuenta gratis
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login">Inicia sesión</Link>
        </p>

        <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', textAlign: 'center', marginTop: '1rem', lineHeight: 1.4 }}>
          Los datos personales recabados serán protegidos, incorporados y tratados en el
          Sistema de Datos Personales de NKUVO IDEAS SAS DE CV. Dichos datos serán
          utilizados para las siguientes finalidades: para el registro de tu cuenta.
          Los datos no serán transferidos a terceros. Si deseas conocer nuestro aviso de
          privacidad integral o ejercer tus derechos ARCO, puedes consultar el sitio web{' '}
          <a href="https://www.nkuvo.com" target="_blank" rel="noreferrer" style={{ color: 'var(--md-primary)' }}>
            www.nkuvo.com
          </a>.
        </p>
      </div>
    </div>
  )
}

function PlanCard({ title, price, features, cta, loading, onClick, variant, highlight }) {
  return (
    <div style={{
      border: highlight ? '2px solid var(--md-primary)' : '1px solid var(--md-outline-variant)',
      borderRadius: 12, padding: '1rem',
      background: highlight ? 'var(--md-surface-container-low)' : 'transparent',
    }}>
      <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--md-on-surface)' }}>{title}</p>
      <p style={{ fontSize: '0.875rem', color: 'var(--md-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>{price}</p>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.875rem' }}>
        {features.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
            <CheckCircle2 size={13} style={{ color: 'var(--md-primary)', flexShrink: 0, marginTop: 1 }} />
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`btn btn-${variant} w-full btn-sm`}
        onClick={onClick}
        disabled={loading}
      >
        {loading ? <span className="spinner spinner-sm" /> : <CreditCard size={14} />}
        {loading ? 'Redirigiendo…' : cta}
      </button>
    </div>
  )
}
