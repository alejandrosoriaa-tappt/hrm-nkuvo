import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload, Trash2, Sparkles, Linkedin, CheckCircle2, XCircle,
  Lock, CreditCard, ClipboardPaste, Wand2, FileText,
} from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const INDUSTRIAS = [
  'Manufactura / Industrial',
  'Tecnología / IT',
  'Ventas / Comercial',
  'Finanzas / Contabilidad',
  'Recursos Humanos',
  'Logística / Cadena de suministro',
  'Marketing / Publicidad',
  'Salud',
  'Educación',
  'Legal',
  'Construcción / Ingeniería civil',
  'Servicio al cliente / Atención',
]

export default function LinkedInPage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('file') // 'file' | 'paste'
  const [pastedText, setPastedText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileRef = useRef(null)

  const [scoreLoading, setScoreLoading] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)
  const [scoreError, setScoreError] = useState(null)

  const [industria, setIndustria] = useState(INDUSTRIAS[0])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)

  const [billing, setBilling] = useState(null)
  const [bundleLoading, setBundleLoading] = useState(false)

  const load = () => {
    hrmAPI.getLinkedinProfile()
      .then(r => {
        setProfile(r.data)
        if (r.data?.heuristic_score != null) {
          setScoreResult({ score: r.data.heuristic_score, checks: r.data.heuristic_checks, totalChecks: r.data.heuristic_checks?.length, passedChecks: r.data.heuristic_checks?.filter(c => c.passed).length })
        }
        if (r.data?.ai_suggestions) setAiResult(r.data.ai_suggestions)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useEffect(() => {
    hrmAPI.getBillingStatus().then(r => setBilling(r.data)).catch(() => {})
  }, [])

  const handleBuyBundle = async () => {
    setBundleLoading(true)
    try {
      const r = await hrmAPI.startBundleCheckout()
      window.location.href = r.data.checkoutUrl
    } catch (err) {
      alert(err.response?.data?.error || err.message)
      setBundleLoading(false)
    }
  }

  const handleUploadFile = async (e) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setUploadError('Solo se aceptan archivos PDF (exporta tu perfil desde LinkedIn: "Más" → "Guardar en PDF").')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('profile', file)
      await hrmAPI.uploadLinkedinProfile(fd)
      if (fileRef.current) fileRef.current.value = ''
      setScoreResult(null)
      setAiResult(null)
      load()
    } catch (err) {
      setUploadError(err.response?.data?.error || err.message)
    } finally {
      setUploading(false)
    }
  }

  const handlePasteText = async (e) => {
    e.preventDefault()
    if (!pastedText.trim()) return
    setUploading(true)
    setUploadError(null)
    try {
      await hrmAPI.pasteLinkedinProfile(pastedText.trim())
      setPastedText('')
      setScoreResult(null)
      setAiResult(null)
      load()
    } catch (err) {
      setUploadError(err.response?.data?.error || err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar tu perfil de LinkedIn guardado?')) return
    try {
      await hrmAPI.deleteLinkedinProfile()
      setProfile(null)
      setScoreResult(null)
      setAiResult(null)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const runScore = async () => {
    setScoreLoading(true)
    setScoreError(null)
    try {
      const r = await hrmAPI.scoreLinkedinProfile()
      setScoreResult(r.data)
    } catch (err) {
      setScoreError(err.response?.data?.error || err.message)
    } finally {
      setScoreLoading(false)
    }
  }

  const runAiSuggest = async () => {
    setAiLoading(true)
    try {
      const r = await hrmAPI.suggestLinkedinAi(industria)
      setAiResult(r.data)
    } catch (err) {
      setAiResult({ error: err.response?.data?.error || err.message, locked: err.response?.data?.locked })
    } finally {
      setAiLoading(false)
    }
  }

  const scoreColor = (score) => {
    if (score >= 85) return '#15803D'
    if (score >= 60) return '#B45309'
    return 'var(--md-error)'
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">LinkedIn Score</h1>
          <p className="page-subtitle">
            Completitud y buenas prácticas de tu perfil ·{' '}
            <Link to="/metodologia-linkedin" target="_blank" style={{ color: 'var(--md-primary)' }}>
              cómo lo calculamos
            </Link>
          </p>
        </div>
      </div>

      {/* Explicación + cross-sell */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <Linkedin size={20} style={{ color: 'var(--md-primary)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: '0.375rem' }}>
            Un score gratis de completitud, y sugerencias por industria con IA
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.6 }}>
            No accedemos a tu cuenta de LinkedIn — exporta tu perfil como PDF ("Más" → "Guardar en PDF")
            o pega el texto directamente. El score de completitud es gratis; el análisis con IA
            comparado contra tu industria es parte del plan de $99 MXN / 30 días.
          </p>
          {billing && !billing.hasCvPack && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} onClick={handleBuyBundle} disabled={bundleLoading}>
              {bundleLoading ? <span className="spinner spinner-sm" /> : <Wand2 size={14} />}
              {bundleLoading ? 'Redirigiendo…' : 'Desbloquear con el plan $99 / 30 días'}
            </button>
          )}
          {billing?.hasCvPack && billing?.linkedinUsage && (
            <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '0.5rem' }}>
              Análisis con IA usados este periodo: {billing.linkedinUsage.used}/{billing.linkedinUsage.limit}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : !profile ? (
        <div className="card">
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--md-on-surface)' }}>
            Sube tu perfil
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className={`btn btn-sm ${mode === 'file' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('file')}>
              <FileText size={14} /> Subir PDF
            </button>
            <button className={`btn btn-sm ${mode === 'paste' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('paste')}>
              <ClipboardPaste size={14} /> Pegar texto
            </button>
          </div>

          {uploadError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{uploadError}</div>}

          {mode === 'file' ? (
            <form onSubmit={handleUploadFile} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="input-group">
                <label className="input-label">PDF exportado de LinkedIn</label>
                <input ref={fileRef} type="file" className="input" accept=".pdf" required />
                <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                  En LinkedIn: abre tu perfil → "Más" → "Guardar en PDF".
                </p>
              </div>
              <div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                  {uploading ? <span className="spinner spinner-sm" /> : <Upload size={15} />}
                  {uploading ? 'Subiendo…' : 'Subir PDF'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePasteText} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="input-group">
                <label className="input-label">Texto de tu perfil</label>
                <textarea
                  className="input"
                  rows={8}
                  placeholder="Copia y pega el contenido de tu perfil de LinkedIn (titular, Acerca de, experiencia, educación, aptitudes)…"
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  required
                />
              </div>
              <div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                  {uploading ? <span className="spinner spinner-sm" /> : <ClipboardPaste size={15} />}
                  {uploading ? 'Guardando…' : 'Guardar texto'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Linkedin size={24} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, color: 'var(--md-on-surface)' }}>
                {profile.storage_path ? 'Perfil subido (PDF)' : 'Perfil pegado (texto)'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                Guardado {new Date(profile.updated_at || profile.created_at).toLocaleDateString('es-MX')}
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={runScore} disabled={scoreLoading}>
              {scoreLoading ? <span className="spinner spinner-sm" /> : <Sparkles size={14} />}
              {scoreResult ? 'Recalcular score' : 'Calcular score'}
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={handleDelete} title="Eliminar y subir otro">
              <Trash2 size={14} />
            </button>
          </div>

          {scoreError && <div className="alert alert-error">{scoreError}</div>}

          {scoreResult && !scoreResult.error && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: 12, background: 'var(--md-surface-container-low)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '2.25rem', fontWeight: 800, color: scoreColor(scoreResult.score), lineHeight: 1 }}>
                  {scoreResult.score}%
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>Score de completitud</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>
                    {scoreResult.passedChecks} de {scoreResult.totalChecks} checks pasados — basado en el criterio
                    público "All-Star" de LinkedIn
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {scoreResult.checks?.map((c, i) => (
                  <div key={i} style={{ padding: '0.75rem', borderRadius: 10, background: c.passed ? 'transparent' : 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      {c.passed
                        ? <CheckCircle2 size={16} style={{ color: '#15803D', flexShrink: 0, marginTop: 1 }} />
                        : <XCircle size={16} style={{ color: 'var(--md-error)', flexShrink: 0, marginTop: 1 }} />}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{c.name}</p>
                        {!c.passed && c.fix && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--md-primary)', marginTop: 4, display: 'flex', gap: '0.375rem' }}>
                            <Sparkles size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                            {c.fix}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Análisis por industria con IA */}
          <div className="card">
            <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.75rem', color: 'var(--md-on-surface)' }}>
              Análisis por industria (IA)
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginBottom: '1rem' }}>
              Elige la industria a la que aplicas — comparamos tu titular, resumen y experiencia contra
              lo que buscan reclutadores de esa industria.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <select className="input" style={{ maxWidth: 280 }} value={industria} onChange={e => setIndustria(e.target.value)}>
                {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={runAiSuggest} disabled={aiLoading}>
                {aiLoading ? <span className="spinner spinner-sm" /> : <Wand2 size={14} />}
                {aiLoading ? 'Analizando…' : 'Analizar con IA'}
              </button>
            </div>

            {aiResult?.locked && (
              <div className="alert alert-info" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
                  <Lock size={14} style={{ flexShrink: 0 }} />
                  Análisis por industria disponible con el plan de $99 MXN / 30 días.
                </div>
                <Link to="/app/membresia" className="btn btn-primary btn-sm">
                  <CreditCard size={13} /> Ver plan
                </Link>
              </div>
            )}

            {aiResult?.error && !aiResult?.locked && (
              <div className="alert alert-error">{aiResult.error}</div>
            )}

            {aiResult && !aiResult.error && !aiResult.locked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="alert alert-info" style={{ alignItems: 'flex-start' }}>
                  <Wand2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>{aiResult.resumen}</span>
                </div>

                {aiResult.checklist?.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--md-on-surface)' }}>
                      Checklist
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {aiResult.checklist.map((step, i) => (
                        <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)', lineHeight: 1.45 }}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {aiResult.sugerencias?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {aiResult.sugerencias.map((s, i) => {
                      const prioridad = (s.prioridad || 'media').toLowerCase()
                      const prioColor = prioridad === 'alta' ? 'var(--md-error)' : prioridad === 'baja' ? 'var(--md-on-surface-variant)' : 'var(--md-primary)'
                      return (
                        <div key={i} style={{ padding: '0.875rem', borderRadius: 10, background: 'var(--md-surface-container-low)', border: '1px solid var(--md-outline-variant)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--md-primary)' }}>{s.seccion || `Sugerencia ${i + 1}`}</p>
                            {s.prioridad && <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: prioColor, textTransform: 'uppercase' }}>{prioridad}</span>}
                          </div>
                          {s.problema && <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.375rem', lineHeight: 1.45 }}><strong>Problema:</strong> {s.problema}</p>}
                          {s.accion && <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)', marginBottom: '0.375rem', lineHeight: 1.45 }}><strong>Qué hacer:</strong> {s.accion}</p>}
                          {s.razon && <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', fontStyle: 'italic', lineHeight: 1.45 }}>{s.razon}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
