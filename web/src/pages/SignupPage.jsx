import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import useAuthStore from '../store/authStore.js'

export default function SignupPage() {
  const { signUp, loginWithGoogle, isLoading, error, clearError } = useAuthStore()
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

  const handleGoogle = async () => {
    clearError()
    await loginWithGoogle()
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

        <div className="auth-divider">o</div>

        <button
          type="button"
          className="btn btn-outline w-full"
          onClick={handleGoogle}
          disabled={isLoading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar con Google
        </button>

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
