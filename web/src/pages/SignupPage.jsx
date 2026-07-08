import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import useAuthStore from '../store/authStore.js'

export default function SignupPage() {
  const { signUp, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [success, setSuccess] = useState(false)

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
    const result = await signUp(form.email, form.password, form.fullName)
    if (result.success) {
      if (result.needsEmailConfirmation) {
        setSuccess(true)
      } else {
        navigate('/app')
      }
    }
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
            <label className="input-label" htmlFor="fullName">Nombre completo</label>
            <input
              id="fullName"
              type="text"
              className="input"
              placeholder="María González"
              value={form.fullName}
              onChange={set('fullName')}
              autoComplete="name"
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
          Al registrarte aceptas el{' '}
          <a href="#" style={{ color: 'var(--md-primary)' }}>Aviso de Privacidad</a>
          {' '}(LFPDPPP).
        </p>
      </div>
    </div>
  )
}
