import { useEffect, useState } from 'react'
import { Send, FileText } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

export default function EnviosPage() {
  const [cvs, setCvs] = useState([])
  const [form, setForm] = useState({ to: '', subject: '', cvId: '', message: '' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    hrmAPI.listCvs().then(r => setCvs(r.data || [])).catch(console.error)
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    setSending(true)
    setResult(null)
    setError(null)
    try {
      await hrmAPI.sendCvEmail({ to: form.to, subject: form.subject, cvId: form.cvId, message: form.message })
      setResult('Correo enviado correctamente.')
      setForm({ to: '', subject: '', cvId: '', message: '' })
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Envíos</h1>
          <p className="page-subtitle">Envía tu CV por correo a una reclutadora directamente desde aquí</p>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        {result && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{result}</div>}
        {error  && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="card">
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Para (correo de la reclutadora)</label>
              <input
                type="email"
                className="input"
                placeholder="reclutadora@empresa.com"
                value={form.to}
                onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Asunto</label>
              <input
                className="input"
                placeholder="Candidatura — Nombre Puesto"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">CV a adjuntar</label>
              {cvs.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
                  No tienes CVs subidos aún. <a href="/app/cvs" style={{ color: 'var(--md-primary)' }}>Sube uno aquí.</a>
                </p>
              ) : (
                <select
                  className="input"
                  value={form.cvId}
                  onChange={e => setForm(f => ({ ...f, cvId: e.target.value }))}
                  required
                >
                  <option value="">Selecciona un CV…</option>
                  {cvs.map(cv => (
                    <option key={cv.id} value={cv.id}>{cv.nombre}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Mensaje (cuerpo del correo)</label>
              <textarea
                className="input"
                placeholder="Hola, me pongo en contacto para presentar mi candidatura…"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={5}
                required
              />
            </div>

            <div>
              <button type="submit" className="btn btn-primary" disabled={sending || cvs.length === 0}>
                {sending ? <span className="spinner spinner-sm" /> : <Send size={15} />}
                {sending ? 'Enviando…' : 'Enviar correo con CV'}
              </button>
            </div>
          </form>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '0.75rem' }}>
          El correo se envía desde la dirección configurada en el servidor. La reclutadora recibirá tu CV como adjunto.
        </p>
      </div>
    </>
  )
}
