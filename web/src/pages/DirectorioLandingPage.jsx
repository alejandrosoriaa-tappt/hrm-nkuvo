import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, CreditCard } from 'lucide-react'
import { directoryAPI } from '../lib/api.js'
import { ORDER_REF_KEY } from './directoryOrderRef.js'

export default function DirectorioLandingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const r = await directoryAPI.checkout(email.trim().toLowerCase())
      sessionStorage.setItem(ORDER_REF_KEY, r.data.orderRef)
      window.location.href = r.data.checkoutUrl
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <p className="auth-logo-text">HRM <span>NKUVO</span></p>
          <p className="auth-tagline">Directorio de reclutadores para candidatos en México</p>
        </div>

        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: '0.5rem' }}>
          147 reclutadoras y agencias verificadas, en un Excel
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '1.25rem' }}>
          Nombre, sitio web, correo, teléfono y ciudad de cada una — incluye agencias
          registradas ante la STPS. Sin mensualidad, un pago único.
        </p>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {[
            '147 reclutadoras y agencias de colocación en México',
            'Contacto directo: sitio web, correo y teléfono',
            'Descarga inmediata en Excel tras el pago',
          ].map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
              {f}
            </li>
          ))}
        </ul>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <span className="spinner spinner-sm" /> : <CreditCard size={16} />}
            {loading ? 'Redirigiendo a Clip…' : 'Comprar por $99 MXN'}
          </button>
        </form>

        <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: '0.75rem', textAlign: 'center' }}>
          Pago procesado de forma segura por{' '}
          <a href="https://clip.mx" target="_blank" rel="noreferrer" style={{ color: 'var(--md-primary)' }}>Clip</a>.
          No guardamos datos de tarjeta.
        </p>

        <p className="auth-footer">
          ¿Buscas contacto ilimitado y seguimiento de candidaturas?{' '}
          <Link to="/signup">Conoce la app completa</Link>
        </p>
      </div>
    </div>
  )
}
