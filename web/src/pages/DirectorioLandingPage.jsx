import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, CreditCard, ShieldCheck, Lock, FileSpreadsheet, Download, Search } from 'lucide-react'
import { directoryAPI } from '../lib/api.js'
import { ORDER_REF_KEY } from './directoryOrderRef.js'

// Actualizar si el directorio crece — ver db/seed_hrm_recruiters.sql
const TOTAL_RECRUITERS = 147
const UPDATED_LABEL = 'Actualizado 12 jul 2026'

// Mismo extracto de 10 filas (5 marcas grandes + 5 boutiques) que se usó en
// el creativo de Instagram, para que la landing tenga el mismo gancho visual.
const PREVIEW_ROWS = [
  { nombre: 'Adecco Querétaro',           industria: 'Generalista, outsourcing/temporal',        sitio: 'adecco.com.mx',                    ciudad: 'Santiago de Querétaro, Qro.' },
  { nombre: 'Manpower Querétaro',         industria: 'Generalista, outsourcing/temporal',        sitio: 'manpower.com.mx',                  ciudad: 'Santiago de Querétaro, Qro.' },
  { nombre: 'Korn Ferry México',          industria: 'Executive search + consultoría',           sitio: 'kornferry.com',                    ciudad: 'CDMX / Monterrey' },
  { nombre: 'Michael Page México',        industria: 'Selección especializada y ejecutiva',      sitio: 'michaelpage.com.mx',                ciudad: 'CDMX / Monterrey' },
  { nombre: 'Randstad Querétaro',         industria: 'Generalista, outsourcing/temporal',        sitio: 'randstad.mx',                      ciudad: 'Santiago de Querétaro, Qro.' },
  { nombre: 'Apoyo Confiable de Personal',industria: 'Generalista ejecutivo/operativo',          sitio: 'apoyoconfiabledepersonal.com.mx',  ciudad: 'CDMX (Roma Norte)' },
  { nombre: 'Coca Consultores',           industria: 'Generalista RH + fiscal/contable',         sitio: 'cocaconsultores.com',               ciudad: 'CDMX (Álvaro Obregón)' },
  { nombre: 'Confisa Group',              industria: 'Boutique retained executive search',       sitio: 'confisagroup.com',                  ciudad: 'CDMX (Polanco)' },
  { nombre: 'Dúo Sinergia',               industria: 'Outsourcing/nómina + generalista',         sitio: 'duosinergia.com',                   ciudad: 'CDMX / Gdl. / Hermosillo' },
  { nombre: 'Great Team Empresarial',     industria: 'RH generalista para PyMEs',                sitio: 'greatteam.mx',                      ciudad: 'CDMX (Roma Norte)' },
]

const FILE_NAME = 'directorio-reclutadoras-hrm-2026-07-12.xlsx'

const FAQS = [
  {
    q: '¿Cuántas veces puedo descargar el archivo?',
    a: 'Una sola. El link de descarga se genera al momento de tu pago y se desactiva en cuanto lo usas — guarda el archivo apenas lo descargues.',
  },
  {
    q: '¿Cómo pago?',
    a: 'Con tarjeta, de forma segura a través de Clip. Nosotros nunca vemos ni guardamos los datos de tu tarjeta.',
  },
  {
    q: '¿El archivo se actualiza después de la compra?',
    a: 'No — es una fotografía del directorio al momento de tu compra. Si prefieres la versión siempre actualizada más contacto ilimitado en la app, existe el plan Pro por $299/mes.',
  },
  {
    q: 'Pagué pero Clip no me regresó a la descarga, ¿qué hago?',
    a: 'Usa el buscador "¿Ya pagaste?" más abajo con el correo que usaste al comprar — ahí recuperas tu descarga directamente, sin esperar a nadie.',
  },
]

export default function DirectorioLandingPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [lookupEmail, setLookupEmail] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [lookupResult, setLookupResult] = useState(null) // { downloadToken, alreadyDownloaded }

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

  const handleLookup = async (e) => {
    e.preventDefault()
    setLookupLoading(true)
    setLookupError(null)
    setLookupResult(null)
    try {
      const r = await directoryAPI.lookup(lookupEmail.trim().toLowerCase())
      setLookupResult(r.data)
    } catch (err) {
      setLookupError(err.response?.data?.error || err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--md-surface-container-low)',
        backgroundImage: 'radial-gradient(var(--md-outline-variant) 1.5px, transparent 1.5px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '3rem 1.25rem 4rem' }}>

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <LogoMark />
            <span style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--md-on-surface)' }}>
              HRM <span style={{ color: 'var(--md-primary)' }}>NKUVO</span>
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.625rem, 4vw, 2.5rem)', fontWeight: 800, lineHeight: 1.25, color: 'var(--md-on-surface)' }}>
            {TOTAL_RECRUITERS} reclutadoras y agencias verificadas,<br />
            en{' '}
            <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--md-primary)', textDecorationThickness: 5, textUnderlineOffset: 6 }}>
              un Excel
            </span>
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--md-on-surface-variant)', marginTop: '0.875rem', maxWidth: 480, marginInline: 'auto' }}>
            Nombre, sitio web, correo, teléfono y ciudad de cada una — incluye agencias
            registradas ante la STPS. Sin mensualidad, un pago único.
          </p>
        </div>

        {/* ── Checkout + preview ── */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Tarjeta de compra */}
          <div className="card" style={{ flex: '1 1 380px', maxWidth: 420 }}>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
              {[
                `${TOTAL_RECRUITERS} reclutadoras y agencias de colocación en México`,
                'Contacto directo: sitio web, correo y teléfono',
                'Descarga inmediata en Excel tras el pago',
              ].map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
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

            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.125rem',
              padding: '0.75rem 0.875rem', borderRadius: 12, background: 'var(--md-surface-container-low)',
            }}>
              <ClipBadge />
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Lock size={13} style={{ color: 'var(--md-primary)' }} />
                  Pago 100% seguro con Clip
                </p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: '0.125rem' }}>
                  Nunca vemos ni guardamos los datos de tu tarjeta.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: '0.75rem', textAlign: 'center' }}>
              Al comprar aceptas nuestro{' '}
              <Link to="/privacidad" style={{ color: 'var(--md-primary)', fontWeight: 500 }}>Aviso de Privacidad</Link>.
            </p>
          </div>

          {/* Preview tipo Excel */}
          <div style={{ flex: '2 1 480px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
                Así se ve un extracto real (10 de {TOTAL_RECRUITERS} filas) — el Excel completo
                también incluye página web, teléfono, correo y ciudad de cada una.
              </span>
              <span style={{ flex: 1 }} />
              <span className="chip chip-success">
                <CheckCircle2 size={12} /> {UPDATED_LABEL}
              </span>
              <span className="chip chip-success">
                {TOTAL_RECRUITERS} registros
              </span>
            </div>

            <div style={{ border: '1px solid var(--md-outline-variant)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Tira de archivo, como el header de un Excel real */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', background: 'var(--md-surface-container-low)', borderBottom: '1px solid var(--md-outline-variant)' }}>
                <FileSpreadsheet size={16} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--md-on-surface-variant)' }}>{FILE_NAME}</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '28%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      {['Reclutadora', 'Industria', 'Sitio web'].map(h => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left', padding: '0.625rem 0.875rem', fontSize: '0.6875rem',
                            fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase',
                            color: '#FFFFFF', background: '#16A34A',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PREVIEW_ROWS.map((row, i) => (
                      <tr key={row.nombre} style={{ background: i % 2 === 1 ? 'var(--md-surface-container-low)' : 'transparent' }}>
                        <td style={{ padding: '0.625rem 0.875rem', borderTop: '1px solid var(--md-outline-variant)', fontWeight: 600, overflowWrap: 'break-word', color: 'var(--md-on-surface)' }}>{row.nombre}</td>
                        <td style={{ padding: '0.625rem 0.875rem', borderTop: '1px solid var(--md-outline-variant)', overflowWrap: 'break-word', color: 'var(--md-on-surface-variant)' }}>{row.industria}</td>
                        <td style={{ padding: '0.625rem 0.875rem', borderTop: '1px solid var(--md-outline-variant)', overflowWrap: 'break-word', color: 'var(--md-on-surface-variant)' }}>{row.sitio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ── Recuperar compra (Clip no siempre regresa al sitio tras pagar) ── */}
        <div className="card" style={{ marginTop: '2.5rem', maxWidth: 480, marginInline: 'auto' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--md-on-surface)', marginBottom: '0.25rem' }}>
            ¿Ya pagaste?
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.875rem' }}>
            Si Clip no te regresó a la descarga, busca tu compra con el correo que usaste al pagar.
          </p>

          <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              required
              style={{ flex: '1 1 200px' }}
            />
            <button type="submit" className="btn btn-outline" disabled={lookupLoading}>
              {lookupLoading ? <span className="spinner spinner-sm" /> : <Search size={15} />}
              Buscar
            </button>
          </form>

          {lookupError && (
            <div className="alert alert-error" style={{ marginTop: '0.875rem' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{lookupError}</span>
            </div>
          )}

          {lookupResult?.downloadToken && (
            <a
              href={directoryAPI.downloadUrl(lookupResult.downloadToken)}
              className="btn btn-primary w-full"
              style={{ marginTop: '0.875rem' }}
            >
              <Download size={16} /> Descargar directorio (Excel)
            </a>
          )}

          {lookupResult?.alreadyDownloaded && (
            <div className="alert alert-info" style={{ marginTop: '0.875rem' }}>
              Esta compra ya se descargó. Cada compra incluye una sola descarga — si necesitas ayuda,{' '}
              <a href="https://wa.me/5215658732336" target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                escríbenos por WhatsApp
              </a>.
            </div>
          )}
        </div>

        {/* ── FAQ ── */}
        <div style={{ marginTop: '3rem', maxWidth: 640, marginInline: 'auto' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: '1rem', textAlign: 'center' }}>
            Preguntas frecuentes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map(f => (
              <div key={f.q} className="card card-sm">
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--md-on-surface)', marginBottom: '0.25rem' }}>{f.q}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
            <ShieldCheck size={13} /> Directorio HRM NKUVO — hrm.nkuvo.com
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
            ¿Buscas contacto ilimitado y seguimiento de candidaturas?{' '}
            <Link to="/signup" style={{ color: 'var(--md-primary)', fontWeight: 500 }}>Conoce la app completa</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M4 34 V14 a6 6 0 0 1 12 0 V34 Z" fill="#16A34A" />
      <path d="M24 34 V14 a6 6 0 0 1 12 0 V34 Z" fill="#34D399" />
    </svg>
  )
}

// Insignia de marca de Clip (procesador de pago) — wordmark propio, no un
// logo oficial descargado, para la señal de confianza en el checkout.
function ClipBadge() {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, borderRadius: 10, background: '#FF5A1F', flexShrink: 0,
      }}
      aria-label="Clip"
    >
      <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#FFFFFF', fontStyle: 'italic' }}>clip</span>
    </div>
  )
}
