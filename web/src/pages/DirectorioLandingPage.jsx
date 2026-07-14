import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, AlertCircle, CreditCard, ShieldCheck, Lock,
  Download, Search, Zap, BadgeCheck, Ban, Clock, GraduationCap, Briefcase,
  UserX, RefreshCw, ArrowDown, MousePointerClick, PackageCheck, Star, Users,
  Calendar, MessageSquare, ListChecks,
} from 'lucide-react'
import { directoryAPI } from '../lib/api.js'
import { ORDER_REF_KEY } from './directoryOrderRef.js'
import { trackPurchaseOnce } from './DirectorioGraciasPage.jsx'

// Actualizar si el directorio crece — ver db/seed_hrm_recruiters.sql
const TOTAL_RECRUITERS = 147
const UPDATED_LABEL = 'Actualizado julio 2026'

// La preview de "así se ve por dentro" es una captura real (excel-preview.jpg)
// generada a partir de 10 filas reales de db/seed_hrm_recruiters.sql, con
// teléfono/correo enmascarados directamente en la imagen — no una tabla
// HTML, para que se vea como una captura de pantalla real de Excel (lo que
// la gente reconoce al instante) en vez de un símil.
const PREVIEW_ROWS_COUNT = 10

const FAQS = [
  {
    q: '¿No puedo buscar esto gratis en Google?',
    a: 'Sí puedes intentarlo — pero arma tú mismo la lista, entra sitio por sitio a sacar correo/teléfono, y verifica cuáles siguen activas y cuáles están registradas ante la STPS. Eso son horas. El directorio ya viene curado, verificado y listo para usarse en el tiempo que tardas en tomarte un café.',
  },
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

const TRUST_CHIPS = [
  { icon: BadgeCheck, label: 'Registradas ante la STPS' },
  { icon: RefreshCw,  label: UPDATED_LABEL },
  { icon: Ban,        label: 'Sin scraping — dato verificado' },
]

const RECEIVES = [
  '147 reclutadoras y agencias de colocación',
  'Correo directo de contacto',
  'Teléfono directo',
  'Sitio web oficial',
  'Ciudad / zona donde operan',
  'Industria o especialidad',
  'Descarga inmediata en Excel',
  'Sin cuenta, sin mensualidad',
]

const STEPS = [
  { icon: CreditCard,          title: 'Compras',   text: 'Un pago único de $99 MXN, procesado por Clip. Solo necesitas tu correo.' },
  { icon: Download,            title: 'Descargas', text: 'El Excel con las 147 reclutadoras está listo al instante — una sola descarga.' },
  { icon: MousePointerClick,   title: 'Contactas', text: 'Escribes directo a quien decide contratar, sin esperar a que una vacante te encuentre.' },
]

// ── Prueba social — SOLO datos reales ───────────────────────────────────
// No fabricar. SOCIAL_PROOF_COUNT y TESTIMONIALS se quedan vacíos/en 0
// hasta que existan compras y testimonios reales; los componentes de abajo
// (chip de contador, sección de reseñas) se auto-ocultan mientras tanto.
//
// Para activar el contador: cambiar SOCIAL_PROOF_COUNT por el número real
// de descargas confirmadas (select count(*) from hrm_directory_purchases
// where status='paid' — ver server/src/routes/directory.js).
// Para activar reseñas: pedirle a un comprador real su OK por WhatsApp para
// citarlo, y agregar un objeto a TESTIMONIALS con su nombre/contexto real.
const SOCIAL_PROOF_COUNT = 0
const TESTIMONIALS = [
  // { name: 'Nombre real', context: 'Contexto real (ej. "Contadora, CDMX")', quote: 'Cita real, con permiso.' },
]

const PERSONAS = [
  { icon: GraduationCap, label: 'Recién egresados' },
  { icon: UserX,          label: 'En búsqueda activa de empleo' },
  { icon: Briefcase,      label: 'Ejecutivos en transición' },
  { icon: Clock,          label: 'Quien no quiere esperar a que lo encuentren' },
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
      window.fbq?.('track', 'InitiateCheckout', { value: 99, currency: 'MXN' })
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
      if (r.data.downloadToken) trackPurchaseOnce(r.data.downloadToken)
      setLookupResult(r.data)
    } catch (err) {
      setLookupError(err.response?.data?.error || err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  const scrollToBuy = () => {
    document.getElementById('comprar')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div style={{ background: 'var(--md-surface)' }}>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — la propuesta de valor + compra caben en la primera pantalla
      ══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: 'var(--md-surface-container-low)',
          backgroundImage: 'radial-gradient(var(--md-outline-variant) 1.5px, transparent 1.5px)',
          backgroundSize: '22px 22px',
          borderBottom: '1px solid var(--md-outline-variant)',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '2.5rem 1.25rem 3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.625rem', marginBottom: '1.75rem' }}>
            <img src="/logo-mark.png" alt="" width={34} height={34} style={{ display: 'block' }} />
            <span style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--md-on-surface)' }}>
              HRM <span style={{ color: 'var(--md-primary)' }}>NKUVO</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Copy + CTA */}
            <div style={{ flex: '1 1 460px', minWidth: 0 }}>
              <span className="chip chip-primary" style={{ marginBottom: '1rem' }}>
                <Zap size={12} /> {TOTAL_RECRUITERS} reclutadoras verificadas · {UPDATED_LABEL}
              </span>
              <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', fontWeight: 800, lineHeight: 1.08, color: 'var(--md-on-surface)', letterSpacing: '-0.02em' }}>
                Encuentra trabajo<br />más rápido.
              </h1>
              <p style={{ fontSize: '1.0625rem', color: 'var(--md-on-surface-variant)', marginTop: '1.125rem', maxWidth: 480, lineHeight: 1.55 }}>
                Accede al directorio privado de <strong style={{ color: 'var(--md-on-surface)' }}>147 reclutadoras y agencias verificadas</strong> de
                México. Correo, teléfono y sitio web de contacto — lo que normalmente te tomaría semanas recopilar, aquí está
                listo para descargar en menos de dos minutos.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.25rem' }}>
                {SOCIAL_PROOF_COUNT > 0 && (
                  <span className="chip chip-primary">
                    <Users size={12} /> {SOCIAL_PROOF_COUNT} candidatos ya lo descargaron
                  </span>
                )}
                {TRUST_CHIPS.map(({ icon: Icon, label }) => (
                  <span key={label} className="chip chip-success"><Icon size={12} /> {label}</span>
                ))}
              </div>

              <button
                type="button"
                onClick={scrollToBuy}
                className="btn btn-primary"
                style={{ marginTop: '1.75rem', padding: '0.875rem 1.75rem', fontSize: '1rem', fontWeight: 700 }}
              >
                Descargar ahora <ArrowDown size={16} />
              </button>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem 1rem', marginTop: '0.75rem' }}>
                {['Descarga inmediata', 'Pago único', 'Sin mensualidad'].map(t => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                    <CheckCircle2 size={12} style={{ color: 'var(--md-primary)' }} /> {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Tarjeta de compra */}
            <div id="comprar" className="card" style={{ flex: '1 1 380px', maxWidth: 420, scrollMarginTop: '2rem' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--md-on-surface)', marginBottom: '0.25rem' }}>
                Descarga el directorio
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '1.125rem' }}>
                Deja tu correo y págalo en el momento — el Excel queda listo al instante.
              </p>

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
                  <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                    Recibirás el archivo inmediatamente después del pago.
                  </p>
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.875rem', fontSize: '0.9375rem', fontWeight: 700 }}>
                  {loading ? <span className="spinner spinner-sm" /> : <Download size={17} />}
                  {loading ? 'Redirigiendo a Clip…' : 'Descargar ahora — $99 MXN'}
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
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MARCAS RECONOCIBLES — prueba de calidad de dato en una línea
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ borderBottom: '1px solid var(--md-outline-variant)', padding: '1.25rem 1.25rem' }}>
        <p style={{
          textAlign: 'center', fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)',
          maxWidth: 900, marginInline: 'auto', lineHeight: 1.8,
        }}>
          <span style={{ fontWeight: 600, color: 'var(--md-on-surface)' }}>Ya están en el directorio: </span>
          Adecco · Manpower · Randstad · Korn Ferry · Michael Page · Boyden · Confisa Group · Coca Consultores ·{' '}
          <span style={{ fontWeight: 600, color: 'var(--md-primary)' }}>+139 más</span>
        </p>
      </div>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 1.25rem' }}>

        {/* ══════════════════════════════════════════════════════════════════
            EXCEL GIGANTE — la percepción de valor se dispara viéndolo grande
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginTop: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--md-on-surface)' }}>
              Así se ve por dentro
            </h2>
            <span style={{ flex: 1 }} />
            <span className="chip chip-success"><CheckCircle2 size={12} /> {UPDATED_LABEL}</span>
            <span className="chip chip-success">{TOTAL_RECRUITERS} registros</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', marginBottom: '1.25rem', maxWidth: 640 }}>
            Captura real de 10 de las {TOTAL_RECRUITERS} filas (correo y teléfono difuminados a propósito).
            El Excel completo trae correo, teléfono, sitio web, ciudad e industria de cada una.
          </p>

          <div style={{ position: 'relative', border: '1px solid var(--md-outline-variant)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-2)' }}>
            <img
              src="/excel-preview.jpg"
              alt="Captura de Excel abierto en macOS mostrando el directorio: columnas ID, Reclutadora, Página web, Teléfono, Correo, Ciudad e Industria, con 10 filas reales de ejemplo (Adecco Querétaro, Boyden México, Confisa Group y otras)"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
            {/* Fade + overlay: comunica que hay muchas más filas sin inventar contenido falso */}
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: '16%',
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.98) 70%)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '1rem',
            }}>
              <span className="chip chip-primary" style={{ fontSize: '0.8125rem', padding: '0.5rem 1.125rem', boxShadow: 'var(--shadow-2)' }}>
                + {TOTAL_RECRUITERS - PREVIEW_ROWS_COUNT} reclutadoras más en tu descarga
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            QUÉ RECIBES — claridad total del producto
        ══════════════════════════════════════════════════════════════════ */}
        <div className="card" style={{ marginTop: '3.5rem', padding: '2rem', background: 'var(--md-primary-container)', border: 'none' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-on-primary-container)', marginBottom: '1.25rem', textAlign: 'center' }}>
            Qué recibes exactamente
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem 1.5rem', maxWidth: 760, marginInline: 'auto' }}>
            {RECEIVES.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--md-on-primary-container)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            OBJECIÓN: "esto lo busco gratis" — comparación honesta
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginTop: '3.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-on-surface)', marginBottom: '1.5rem', textAlign: 'center' }}>
            El producto no es el Excel. Es el tiempo que te ahorra.
          </h2>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: '1 1 300px' }}>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.875rem' }}>
                Buscarlo tú mismo
              </p>
              {[
                'Googlear reclutadoras una por una',
                'Entrar a cada sitio a sacar correo y teléfono',
                'Revisar cuáles siguen activas',
                'Verificar cuáles están registradas ante la STPS',
                'Horas de trabajo antes de mandar el primer correo',
              ].map(t => (
                <div key={t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                  <Ban size={15} style={{ color: 'var(--md-error)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>{t}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ flex: '1 1 300px', borderColor: 'var(--md-primary)', borderWidth: 2 }}>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--md-primary)', marginBottom: '0.875rem' }}>
                Comprar el directorio
              </p>
              {[
                '147 reclutadoras ya verificadas y curadas',
                'Correo, teléfono y sitio de cada una, listos',
                'Registradas ante la STPS',
                'Excel descargado en menos de 2 minutos',
                'Empiezas a contactar hoy, no en dos semanas',
              ].map(t => (
                <div key={t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--md-primary)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)', fontWeight: 500 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CÓMO FUNCIONA
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginTop: '3.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-on-surface)', marginBottom: '1.5rem', textAlign: 'center' }}>
            Cómo funciona
          </h2>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="card" style={{ flex: '1 1 220px', textAlign: 'center' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: 'var(--md-primary-container)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginInline: 'auto', marginBottom: '0.875rem',
                }}>
                  <Icon size={20} style={{ color: 'var(--md-primary)' }} />
                </div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--md-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Paso {i + 1}
                </p>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--md-on-surface)', marginTop: '0.25rem' }}>{title}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginTop: '0.375rem' }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PARA QUIÉN ES
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginTop: '3.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-on-surface)', marginBottom: '1.5rem', textAlign: 'center' }}>
            ¿Para quién es este directorio?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            {PERSONAS.map(({ icon: Icon, label }) => (
              <div key={label} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Icon size={20} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--md-on-surface)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            GARANTÍA — 3 días, devolución real (proceso manual vía WhatsApp +
            reembolso desde el dashboard de Clip, no hay refund automatizado)
        ══════════════════════════════════════════════════════════════════ */}
        <div className="card" style={{ marginTop: '3.5rem', maxWidth: 640, marginInline: 'auto', textAlign: 'center', padding: '2rem' }}>
          <PackageCheck size={30} style={{ color: 'var(--md-primary)', marginBottom: '0.75rem' }} />
          <p style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--md-on-surface)', marginBottom: '0.5rem' }}>
            Garantía de 3 días
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.6 }}>
            Si el directorio no te sirve, escríbenos por WhatsApp dentro de los primeros 3 días
            después de tu compra y te devolvemos tu dinero — sin preguntas. Y si el archivo no
            te llegó, lo recuperas con el buscador "¿Ya pagaste?" de abajo.
          </p>
        </div>

        {/* ── Recuperar compra (Clip no siempre regresa al sitio tras pagar) ── */}
        <div className="card" style={{ marginTop: '1.5rem', maxWidth: 480, marginInline: 'auto' }}>
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

        {/* ── Reseñas — solo se renderiza si TESTIMONIALS trae datos reales ── */}
        {TESTIMONIALS.length > 0 && (
          <div style={{ marginTop: '3rem', maxWidth: 900, marginInline: 'auto' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: '1rem', textAlign: 'center' }}>
              Lo que dicen quienes ya lo compraron
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {TESTIMONIALS.map(t => (
                <div key={t.name} className="card card-sm">
                  <div style={{ display: 'flex', gap: 2, marginBottom: '0.5rem' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} fill="var(--md-primary)" style={{ color: 'var(--md-primary)' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)', lineHeight: 1.5, marginBottom: '0.625rem' }}>
                    "{t.quote}"
                  </p>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--md-on-surface-variant)' }}>
                    {t.name} · {t.context}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* ── CTA final ── */}
        <div style={{ marginTop: '3.5rem', textAlign: 'center', padding: '2.5rem 1.5rem', background: 'var(--md-primary)', borderRadius: 24 }}>
          <p style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--md-on-primary)', marginBottom: '0.5rem' }}>
            147 reclutadoras te están esperando.
          </p>
          <p style={{ fontSize: '0.9375rem', color: 'var(--md-on-primary)', opacity: 0.9, marginBottom: '1.5rem' }}>
            Un pago único de $99 MXN. Descarga inmediata.
          </p>
          <button
            type="button"
            onClick={scrollToBuy}
            className="btn"
            style={{ background: 'var(--md-on-primary)', color: 'var(--md-primary)', padding: '0.875rem 1.75rem', fontSize: '0.9375rem', fontWeight: 700 }}
          >
            <Download size={17} /> Descargar ahora
          </button>
        </div>

        {/* ── Cross-sell a HRM Pro — el directorio es la puerta de entrada,
            no el negocio en sí. Solo features que YA existen en la app. ── */}
        <div className="card" style={{ marginTop: '2rem', maxWidth: 640, marginInline: 'auto', padding: '1.75rem' }}>
          <p style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--md-on-surface)', marginBottom: '0.375rem' }}>
            ¿Y ahora qué hago con estos contactos?
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '1rem' }}>
            El directorio es solo el primer paso. HRM Pro te ayuda a llevar el seguimiento de cada contacto:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.625rem', marginBottom: '1.25rem' }}>
            {[
              { icon: ListChecks,     text: 'Guarda y da seguimiento a cada reclutadora que contactaste' },
              { icon: MessageSquare,  text: 'Plantillas de mensajes listas para copiar y pegar' },
              { icon: Calendar,       text: 'Agenda tus entrevistas y citas de seguimiento' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <Icon size={15} style={{ color: 'var(--md-primary)', flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)' }}>{text}</span>
              </div>
            ))}
          </div>
          <Link to="/signup" className="btn btn-outline" style={{ fontSize: '0.8125rem' }}>
            Conoce HRM Pro — $299/mes
          </Link>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '3rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
            <ShieldCheck size={13} /> Directorio HRM NKUVO — hrm.nkuvo.com
          </p>
        </div>
      </div>
    </div>
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
