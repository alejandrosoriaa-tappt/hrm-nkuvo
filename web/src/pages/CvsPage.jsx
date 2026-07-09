import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Upload, Trash2, Sparkles, FileText, CheckCircle2, XCircle, Lock, CreditCard, AlertTriangle, Wand2 } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const MAX_CVS = 5

export default function CvsPage() {
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [atsModal, setAtsModal] = useState(null)
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState(null)
  const [cvName, setCvName] = useState('')
  const [rewriteModal, setRewriteModal] = useState(null)
  const [rewriteLoading, setRewriteLoading] = useState(false)
  const [rewriteResult, setRewriteResult] = useState(null)
  const [rewriteContexto, setRewriteContexto] = useState('')
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

  const runAtsCheck = async (cv) => {
    setAtsModal(cv)
    setAtsResult(null)
    setAtsLoading(true)
    try {
      const r = await hrmAPI.checkCvAts(cv.id)
      setAtsResult(r.data)
      load()
    } catch (err) {
      setAtsResult({ error: err.response?.data?.error || err.message })
    } finally {
      setAtsLoading(false)
    }
  }

  const openRewrite = (cv) => {
    setRewriteModal(cv)
    setRewriteResult(cv.rewrite_suggestions || null)
    setRewriteContexto('')
  }

  const runRewrite = async () => {
    if (!rewriteModal) return
    setRewriteLoading(true)
    try {
      const r = await hrmAPI.rewriteCv(rewriteModal.id, rewriteContexto)
      setRewriteResult(r.data)
      load()
    } catch (err) {
      setRewriteResult({ error: err.response?.data?.error || err.message, locked: err.response?.data?.locked })
    } finally {
      setRewriteLoading(false)
    }
  }

  // Criterio duro a propósito: un reclutador solo revisa una fracción de
  // los CVs que le llegan, así que cualquier score debajo del umbral (90)
  // deja al candidato en desventaja — no hay "aprobado a medias".
  const PASSING_SCORE = 90
  const scoreColor = (score) => {
    if (score >= PASSING_SCORE) return '#15803D'
    if (score >= 70) return '#B45309'
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

      {/* Por qué importa el formato ATS */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <AlertTriangle size={20} style={{ color: 'var(--md-primary)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: '0.375rem' }}>
            Antes de que un reclutador vea tu CV, un ATS lo filtra
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.6 }}>
            Se estima que <strong>~98% de las empresas grandes</strong> usan un ATS (Applicant Tracking
            System) para recibir CVs, y que <strong>~75% de los CVs se descartan automáticamente</strong> por
            problemas de formato — tablas, columnas, contacto ilegible o secciones sin nombre estándar —
            antes de que una persona los lea. No importa qué tan bueno sea tu perfil: si el ATS no puede
            leerlo, nunca llega al reclutador. Por eso el ATS check (score de formato) y
            “Sugerir con IA” (pasos concretos para llegar al 100% de compliance ATS) trabajan
            juntos en esta página.
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
                  <div style={{ fontSize: '0.6875rem', color: cv.ats_score >= PASSING_SCORE ? 'var(--md-on-surface-variant)' : 'var(--md-error)', fontWeight: cv.ats_score >= PASSING_SCORE ? 400 : 600 }}>
                    {cv.ats_score >= PASSING_SCORE ? 'ATS score' : 'En desventaja'}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => runAtsCheck(cv)}
                  title="Revisar formato para ATS"
                >
                  <Sparkles size={14} />
                  ATS check
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => openRewrite(cv)}
                  title="Sugerencias de formato ATS con IA (Pro)"
                >
                  <Wand2 size={14} />
                  Sugerir con IA
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
              Revisión de formato: qué tan legible es tu CV para un sistema ATS,
              sin importar a qué vacante específica lo mandes.
            </p>

            {atsLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="spinner" />
              </div>
            )}

            {atsResult && !atsResult.error && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    <p style={{ fontWeight: 600 }}>ATS Score de formato</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
                      {atsResult.passedChecks} de {atsResult.totalChecks} checks pasados
                    </p>
                  </div>
                </div>

                {/* Veredicto crítico */}
                <div className={atsResult.passesThreshold ? 'alert alert-success' : 'alert alert-error'} style={{ alignItems: 'flex-start' }}>
                  {atsResult.passesThreshold
                    ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                  <span style={{ fontSize: '0.8125rem' }}>{atsResult.verdict}</span>
                </div>

                {/* Checks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {atsResult.results?.map((r, i) => (
                    <div key={i} style={{
                      padding: '0.75rem', borderRadius: 10,
                      background: r.passed ? 'transparent' : 'var(--md-surface-container-low)',
                      border: '1px solid var(--md-outline-variant)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        {r.passed
                          ? <CheckCircle2 size={16} style={{ color: '#15803D', flexShrink: 0, marginTop: 1 }} />
                          : <XCircle size={16} style={{ color: 'var(--md-error)', flexShrink: 0, marginTop: 1 }} />}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{r.name}</p>
                          {!r.passed && r.issue && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: 2 }}>
                              {r.issue}
                            </p>
                          )}
                          {!r.passed && r.fix && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--md-primary)', marginTop: 4, display: 'flex', gap: '0.375rem' }}>
                              <Sparkles size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                              {r.fix}
                            </p>
                          )}
                          {!r.passed && r.fix === undefined && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <Lock size={12} style={{ flexShrink: 0 }} />
                              Cómo arreglarlo — disponible con plan Pro
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {!atsResult.isPro && atsResult.results?.some(r => !r.passed) && (
                  <div className="alert alert-info" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: '0.8125rem' }}>
                      Suscríbete a Pro para ver exactamente cómo corregir cada problema detectado.
                    </p>
                    <Link to="/app/membresia" className="btn btn-primary btn-sm">
                      <CreditCard size={13} /> Suscribirme
                    </Link>
                  </div>
                )}
              </div>
            )}

            {atsResult?.error && (
              <div className="alert alert-error">{atsResult.error}</div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAtsModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sugerir con IA (formato ATS) */}
      {rewriteModal && (
        <div className="modal-backdrop" onClick={() => setRewriteModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Sugerir con IA — {rewriteModal.nombre}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '1.25rem' }}>
              Pasos concretos de <strong>formato y estructura</strong> para que un ATS lea tu CV
              correctamente. No reescribe tu experiencia: te dice qué editar para llegar a
              100% de compliance ATS.
            </p>

            {!rewriteResult && !rewriteLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={runRewrite} disabled={rewriteLoading}>
                  <Wand2 size={15} />
                  Generar sugerencias ATS
                </button>
              </div>
            )}

            {rewriteLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem' }}>
                <div className="spinner" />
                <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
                  Analizando formato del CV…
                </p>
              </div>
            )}

            {rewriteResult?.locked && (
              <div className="alert alert-info" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
                  <Lock size={14} style={{ flexShrink: 0 }} />
                  Sugerencias con IA disponibles con plan Pro.
                </div>
                <Link to="/app/membresia" className="btn btn-primary btn-sm">
                  <CreditCard size={13} /> Suscribirme
                </Link>
              </div>
            )}

            {rewriteResult?.error && !rewriteResult?.locked && (
              <div className="alert alert-error">{rewriteResult.error}</div>
            )}

            {rewriteResult && !rewriteResult.error && !rewriteResult.locked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(rewriteResult.score_actual != null) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.875rem 1rem', borderRadius: 12,
                    background: 'var(--md-surface-container-low)'
                  }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor(rewriteResult.score_actual), lineHeight: 1 }}>
                      {rewriteResult.score_actual}%
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Score actual de formato</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                        Objetivo: {rewriteResult.objetivo ?? 100}% compliance ATS
                      </p>
                    </div>
                  </div>
                )}

                <div className="alert alert-info" style={{ alignItems: 'flex-start' }}>
                  <Wand2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.8125rem' }}>{rewriteResult.resumen}</span>
                </div>

                {rewriteResult.checklist_100?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--md-on-surface)' }}>
                      Checklist para 100%
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {rewriteResult.checklist_100.map((step, i) => (
                        <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)', lineHeight: 1.45 }}>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {rewriteResult.sugerencias?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--md-on-surface)' }}>
                      Acciones de formato
                    </p>
                    {rewriteResult.sugerencias.map((s, i) => {
                      const problema = s.problema || s.original
                      const accion = s.accion || s.sugerido
                      const prioridad = (s.prioridad || 'media').toLowerCase()
                      const prioColor = prioridad === 'alta' ? 'var(--md-error)'
                        : prioridad === 'baja' ? 'var(--md-on-surface-variant)'
                        : 'var(--md-primary)'
                      return (
                        <div key={i} style={{
                          padding: '0.875rem', borderRadius: 10,
                          background: 'var(--md-surface-container-low)',
                          border: '1px solid var(--md-outline-variant)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--md-primary)' }}>
                              {s.seccion || `Sugerencia ${i + 1}`}
                            </p>
                            {s.prioridad && (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: prioColor, textTransform: 'uppercase' }}>
                                {prioridad}
                              </span>
                            )}
                          </div>
                          {problema && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.375rem' }}>
                              <strong>Problema:</strong> {problema}
                            </p>
                          )}
                          {accion && (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)', marginBottom: '0.375rem' }}>
                              <strong>Qué hacer:</strong> {accion}
                            </p>
                          )}
                          {s.ejemplo && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.375rem', fontFamily: 'ui-monospace, monospace' }}>
                              <strong>Ejemplo:</strong> {s.ejemplo}
                            </p>
                          )}
                          {s.razon && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', fontStyle: 'italic' }}>
                              {s.razon}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {rewriteResult.sugerencias?.length === 0 && (
                  <div className="alert alert-success" style={{ alignItems: 'flex-start' }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: '0.8125rem' }}>
                      No hay correcciones de formato pendientes. Vuelve a correr el ATS check para confirmar el score.
                    </span>
                  </div>
                )}

                <button className="btn btn-outline btn-sm" onClick={() => { setRewriteResult(null); setRewriteContexto('') }}>
                  <Wand2 size={14} /> Regenerar
                </button>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setRewriteModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
