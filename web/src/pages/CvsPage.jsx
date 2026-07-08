import { useEffect, useState, useRef } from 'react'
import { Upload, Trash2, Sparkles, FileText, CheckCircle2 } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const MAX_CVS = 5

export default function CvsPage() {
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [atsModal, setAtsModal] = useState(null)
  const [atsJob, setAtsJob] = useState('')
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState(null)
  const [cvName, setCvName] = useState('')
  const fileRef = useRef(null)

  const load = () => {
    hrmAPI.listCvs()
      .then(r => setCvs(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleUpload = async (e) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    if (cvs.length >= MAX_CVS) {
      setUploadError(`Máximo ${MAX_CVS} variantes de CV. Elimina uno antes de subir otro.`)
      return
    }

    const allowed = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowed.includes(file.type)) {
      setUploadError('Solo se aceptan archivos PDF o DOCX.')
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('cv', file)
      fd.append('nombre', cvName || file.name.replace(/\.[^.]+$/, ''))
      await hrmAPI.uploadCv(fd)
      setCvName('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (err) {
      setUploadError(err.response?.data?.error || err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este CV?')) return
    try {
      await hrmAPI.deleteCv(id)
      load()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const handleAts = async (e) => {
    e.preventDefault()
    if (!atsModal || !atsJob.trim()) return
    setAtsLoading(true)
    setAtsResult(null)
    try {
      const r = await hrmAPI.checkCvAts(atsModal.id, atsJob)
      setAtsResult(r.data)
    } catch (err) {
      setAtsResult({ error: err.response?.data?.error || err.message })
    } finally {
      setAtsLoading(false)
    }
  }

  const scoreColor = (score) => {
    if (score >= 70) return '#15803D'
    if (score >= 40) return '#854D0E'
    return 'var(--md-error)'
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis CVs</h1>
          <p className="page-subtitle">
            Hasta {MAX_CVS} variantes · {cvs.length}/{MAX_CVS} usadas
          </p>
        </div>
      </div>

      {/* Upload */}
      {cvs.length < MAX_CVS && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--md-on-surface)' }}>
            Subir nueva variante
          </h2>
          {uploadError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{uploadError}</div>}
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="input-group">
              <label className="input-label">Nombre de la variante</label>
              <input
                className="input"
                placeholder='Ej: "CV - Gerencia Comercial"'
                value={cvName}
                onChange={e => setCvName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Archivo (PDF o DOCX)</label>
              <input
                ref={fileRef}
                type="file"
                className="input"
                accept=".pdf,.docx"
                required
              />
            </div>
            <div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                {uploading ? <span className="spinner spinner-sm" /> : <Upload size={15} />}
                {uploading ? 'Subiendo…' : 'Subir CV'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : cvs.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <p style={{ fontWeight: 600 }}>Sin CVs aún</p>
          <p style={{ fontSize: '0.875rem' }}>Sube tu primer CV usando el formulario de arriba.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {cvs.map(cv => (
            <div key={cv.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <FileText size={24} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: '2px' }}>{cv.nombre}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                  Subido {new Date(cv.created_at).toLocaleDateString('es-MX')}
                </p>
              </div>

              {cv.ats_score != null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: scoreColor(cv.ats_score) }}>
                    {cv.ats_score}%
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)' }}>ATS score</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setAtsModal(cv); setAtsJob(''); setAtsResult(null) }}
                  title="Verificar contra descripción de puesto"
                >
                  <Sparkles size={14} />
                  ATS check
                </button>
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => handleDelete(cv.id)}
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cvs.length >= MAX_CVS && (
        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          Alcanzaste el límite de {MAX_CVS} variantes. Elimina una antes de subir otra.
        </div>
      )}

      {/* Modal ATS */}
      {atsModal && (
        <div className="modal-backdrop" onClick={() => setAtsModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">ATS Check — {atsModal.nombre}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '1.25rem' }}>
              Pega la descripción del puesto y compararemos las keywords contra tu CV.
            </p>

            <form onSubmit={handleAts} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Descripción del puesto</label>
                <textarea
                  className="input"
                  placeholder="Pega aquí los requisitos y responsabilidades del rol…"
                  value={atsJob}
                  onChange={e => setAtsJob(e.target.value)}
                  rows={6}
                  required
                />
              </div>

              {atsResult && !atsResult.error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Score */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem', borderRadius: 12,
                    background: 'var(--md-surface-container-low)'
                  }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreColor(atsResult.score), lineHeight: 1 }}>
                      {atsResult.score}%
                    </div>
                    <div>
                      <p style={{ fontWeight: 600 }}>ATS Score</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
                        {atsResult.matchedKeywords?.length || 0} de {atsResult.totalKeywords || 0} keywords
                      </p>
                    </div>
                  </div>

                  {/* Keywords encontradas */}
                  {atsResult.matchedKeywords?.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#15803D' }}>
                        ✓ Keywords presentes
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {atsResult.matchedKeywords.map(k => (
                          <span key={k} className="chip chip-success">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords faltantes */}
                  {atsResult.missingKeywords?.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--md-error)' }}>
                        ✗ Keywords faltantes (considera agregarlas)
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {atsResult.missingKeywords.map(k => (
                          <span key={k} className="chip chip-error">{k}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sugerencias de estructura */}
                  {atsResult.suggestions?.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        💡 Sugerencias de estructura
                      </p>
                      <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {atsResult.suggestions.map((s, i) => (
                          <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {atsResult?.error && (
                <div className="alert alert-error">{atsResult.error}</div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setAtsModal(null)}>Cerrar</button>
                <button type="submit" className="btn btn-primary" disabled={atsLoading}>
                  {atsLoading ? <span className="spinner spinner-sm" /> : <Sparkles size={15} />}
                  {atsLoading ? 'Analizando…' : 'Analizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
