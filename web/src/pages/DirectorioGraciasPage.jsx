import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, AlertCircle, MessageCircle } from 'lucide-react'
import { directoryAPI } from '../lib/api.js'
import { ORDER_REF_KEY } from './directoryOrderRef.js'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 2 * 60 * 1000

export default function DirectorioGraciasPage() {
  const [state, setState] = useState('polling') // polling | ready | downloaded | timeout | error | missing_ref
  const [downloadToken, setDownloadToken] = useState(null)
  const pollStartRef = useRef(Date.now())

  useEffect(() => {
    const orderRef = sessionStorage.getItem(ORDER_REF_KEY)
    if (!orderRef) {
      setState('missing_ref')
      return
    }

    let cancelled = false
    const poll = async () => {
      try {
        const r = await directoryAPI.status(orderRef)
        if (cancelled) return

        if (r.data.status === 'paid' && r.data.downloadToken) {
          setDownloadToken(r.data.downloadToken)
          setState('ready')
          return
        }
        if (r.data.status === 'paid' && r.data.alreadyDownloaded) {
          setState('downloaded')
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

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <p className="auth-logo-text">HRM <span>NKUVO</span></p>
        </div>

        {state === 'polling' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem 0' }}>
            <div className="spinner" />
            <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', textAlign: 'center' }}>
              Confirmando tu pago con Clip… esto puede tardar unos segundos.
            </p>
          </div>
        )}

        {state === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--md-on-surface)' }}>
              ¡Pago confirmado!
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
              Tu directorio está listo. El link de descarga es de un solo uso — guarda el archivo
              en cuanto lo descargues.
            </p>
            <a
              href={directoryAPI.downloadUrl(downloadToken)}
              className="btn btn-primary w-full"
              onClick={() => setState('downloaded')}
            >
              <Download size={16} /> Descargar directorio (Excel)
            </a>
          </div>
        )}

        {state === 'downloaded' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--md-on-surface)' }}>Descarga en curso</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
              Revisa tu carpeta de descargas. Si necesitas ayuda, escríbenos por WhatsApp.
            </p>
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
