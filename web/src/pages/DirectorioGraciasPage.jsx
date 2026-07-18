import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, AlertCircle, MessageCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { directoryAPI, hrmAPI } from '../lib/api.js'
import supabase from '../lib/supabase.js'
import { ORDER_REF_KEY } from './directoryOrderRef.js'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 2 * 60 * 1000

// Dispara el evento Purchase de Meta Pixel una sola vez por compra (marcado
// por una llave única en localStorage — orderRef desde /directorio/gracias,
// o el correo normalizado desde el buscador "¿Ya pagaste?" de la landing) —
// evita contar la misma compra dos veces si el comprador refresca o vuelve.
export function trackPurchaseOnce(dedupeKey) {
  const key = `hrm_directory_purchase_tracked:${dedupeKey}`
  if (localStorage.getItem(key)) return
  window.fbq?.('track', 'Purchase', { value: 99, currency: 'MXN' })
  localStorage.setItem(key, '1')
}

// Dispara la descarga del Excel usando el endpoint autenticado (blob), sin
// salir de la página — mismo patrón que cualquier descarga con auth header.
async function triggerDirectoryDownload() {
  const r = await hrmAPI.downloadDirectoryExcel()
  const url = window.URL.createObjectURL(new Blob([r.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = `directorio-reclutadoras-hrm-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default function DirectorioGraciasPage() {
  // polling | signing_in | ready | link_expired | timeout | error | missing_ref
  const [state, setState] = useState('polling')
  const [email, setEmail] = useState(null)
  const [downloadError, setDownloadError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const pollStartRef = useRef(Date.now())
  const navigate = useNavigate()

  useEffect(() => {
    window.fbq?.('track', 'PageView', { content_name: 'directorio_gracias', content_category: 'landing' })
  }, [])

  const signIn = async (tokenHash, tokenType) => {
    setState('signing_in')
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType || 'magiclink' })
    if (error) {
      setState('link_expired')
      return
    }
    setState('ready')
  }

  useEffect(() => {
    const orderRef = new URLSearchParams(window.location.search).get('orderRef')
      || sessionStorage.getItem(ORDER_REF_KEY)
    if (!orderRef) {
      setState('missing_ref')
      return
    }

    let cancelled = false
    const poll = async () => {
      try {
        const r = await directoryAPI.status(orderRef)
        if (cancelled) return

        if (r.data.status === 'paid' && r.data.tokenHash) {
          trackPurchaseOnce(orderRef)
          setEmail(r.data.email || null)
          await signIn(r.data.tokenHash, r.data.tokenType)
          return
        }
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          setState('timeout')
          return
        }
        setTimeout(poll, POLL_INTERVAL_MS)
      } catch (err) {
        if (!cancelled) setState('error')
      }
    }
    poll()

    return () => { cancelled = true }
  }, [])

  const handleRetryAccess = async () => {
    if (!email) return
    setRetrying(true)
    try {
      const r = await directoryAPI.lookup(email)
      await signIn(r.data.tokenHash, r.data.tokenType)
    } catch (err) {
      setState('error')
    } finally {
      setRetrying(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      await triggerDirectoryDownload()
    } catch (err) {
      setDownloadError(err.response?.data?.error || err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <p className="auth-logo-text">HRM <span>NKUVO</span></p>
        </div>

        {(state === 'polling' || state === 'signing_in') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem 0' }}>
            <div className="spinner" />
            <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', textAlign: 'center' }}>
              {state === 'polling'
                ? 'Confirmando tu pago con Clip… esto puede tardar unos segundos.'
                : 'Activando tu acceso…'}
            </p>
          </div>
        )}

        {state === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
            <CheckCircle2 size={40} style={{ color: '#15803D' }} />
            <p style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--md-on-surface)' }}>
              Ya tienes acceso
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
              Tu pago se confirmó y tu cuenta ya está activa por 30 días — sin contraseña que
              recordar. Tienes contacto ilimitado con todas las reclutadoras, ATS Checker con IA
              y LinkedIn Score con IA.
            </p>

            {downloadError && (
              <div className="alert alert-error" style={{ width: '100%' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{downloadError}</span>
              </div>
            )}

            <button className="btn btn-outline w-full" onClick={handleDownload} disabled={downloading}>
              {downloading ? <span className="spinner spinner-sm" /> : <Download size={16} />}
              {downloading ? 'Descargando…' : 'Descargar directorio ahora (Excel)'}
            </button>

            <button className="btn btn-primary w-full" onClick={() => navigate('/app')}>
              Entrar a la app <ArrowRight size={16} />
            </button>
          </div>
        )}

        {state === 'link_expired' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="alert alert-error">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>Tu link de acceso ya expiró. Genera uno nuevo con un clic.</span>
            </div>
            <button className="btn btn-primary w-full" onClick={handleRetryAccess} disabled={retrying || !email}>
              {retrying ? <span className="spinner spinner-sm" /> : null}
              {retrying ? 'Generando…' : 'Generar acceso de nuevo'}
            </button>
            <SupportLink />
          </div>
        )}

        {(state === 'timeout' || state === 'error' || state === 'missing_ref') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="alert alert-error">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>
                {state === 'missing_ref'
                  ? 'No encontramos tu pedido en este navegador. Si ya pagaste, escríbenos por WhatsApp con tu correo.'
                  : state === 'timeout'
                    ? 'Seguimos sin confirmar tu pago. Si Clip ya te cobró, escríbenos por WhatsApp.'
                    : 'No pudimos verificar tu pedido. Intenta de nuevo o escríbenos por WhatsApp.'}
              </span>
            </div>
            <SupportLink />
          </div>
        )}

        <p className="auth-footer">
          <Link to="/directorio">Volver</Link>
        </p>
      </div>
    </div>
  )
}

function SupportLink() {
  return (
    <a href="https://wa.me/5215658732336" target="_blank" rel="noreferrer" className="btn btn-outline w-full">
      <MessageCircle size={14} /> Soporte por WhatsApp
    </a>
  )
}
