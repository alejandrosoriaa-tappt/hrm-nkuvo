import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Download, ExternalLink, Mail, Phone, Lock } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const STATUS_LABELS = {
  contactado:  { label: 'Contactado',   cls: 'chip' },
  en_proceso:  { label: 'En proceso',   cls: 'chip chip-primary' },
  respuesta:   { label: 'Con respuesta',cls: 'chip chip-success' },
  descartado:  { label: 'Descartado',   cls: 'chip chip-error' },
}

const EMPTY_FORM = {
  recruiter_id: '',
  status: 'contactado',
  notas: '',
  fecha_contacto: new Date().toISOString().slice(0, 16),
}

export default function ContactosPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | { ...contact }
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [quota, setQuota] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([hrmAPI.listContacts(), hrmAPI.getContactQuota()])
      .then(([r, q]) => {
        setContacts(r.data || [])
        setQuota(q.data || null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const atContactLimit = Boolean(quota && !quota.isPro && !quota.allowed)

  const openNew = () => {
    if (atContactLimit) {
      setError(`Has alcanzado el límite de ${quota.limit} contactos del plan gratuito.`)
      return
    }
    setForm(EMPTY_FORM)
    setModal('new')
    setError(null)
  }

  const openEdit = (c) => {
    setForm({
      recruiter_id: c.recruiter_id,
      status: c.status,
      notas: c.notas || '',
      fecha_contacto: c.fecha_contacto?.slice(0, 16) || EMPTY_FORM.fecha_contacto,
    })
    setModal(c)
    setError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (modal === 'new') {
        if (atContactLimit) {
          setError(`Has alcanzado el límite de ${quota.limit} contactos del plan gratuito.`)
          setSaving(false)
          return
        }
        await hrmAPI.createContact(form)
      } else {
        await hrmAPI.updateContact(modal.id, {
          status: form.status,
          notas: form.notas,
          fecha_contacto: form.fecha_contacto,
        })
      }
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este contacto?')) return
    try {
      await hrmAPI.deleteContact(id)
      load()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // El endpoint devuelve un blob de Excel
      const res = await fetch('/api/hrm/contacts/export', {
        headers: {
          Authorization: `Bearer ${(await import('../lib/supabase.js').then(m => m.default.auth.getSession())).data.session?.access_token}`
        }
      })
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mis-contactos-hrm-${new Date().toISOString().slice(0,10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contactos</h1>
          <p className="page-subtitle">
            Seguimiento de reclutadores con quienes ya interactuaste
            {quota && !quota.isPro ? ` · ${quota.count}/${quota.limit} del plan gratuito` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={exporting}>
            <Download size={15} />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
          {atContactLimit ? (
            <Link to="/app/membresia" className="btn btn-primary btn-sm">
              <Lock size={15} /> Límite free — ver Pro
            </Link>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={openNew}>
              <Plus size={15} /> Nuevo contacto
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p style={{ fontWeight: 600 }}>Sin contactos aún</p>
          <p style={{ fontSize: '0.875rem' }}>Agrega un reclutador desde el directorio o usa el botón de arriba.</p>
          {atContactLimit ? (
            <Link to="/app/membresia" className="btn btn-primary btn-sm">
              <Lock size={15} /> Ver plan Pro
            </Link>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={openNew}>
              <Plus size={15} /> Agregar
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reclutador</th>
                <th>Industria</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Fecha de contacto</th>
                <th>Notas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => {
                const status = STATUS_LABELS[c.status] || STATUS_LABELS.contactado
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>
                      {c.hrm_recruiters?.nombre || '—'}
                    </td>
                    <td style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.8125rem' }}>
                      {c.hrm_recruiters?.industria || '—'}
                    </td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {c.hrm_recruiters?.email || c.hrm_recruiters?.telefono ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {c.hrm_recruiters.email && (
                            <a href={`mailto:${c.hrm_recruiters.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--md-primary)' }}>
                              <Mail size={12} /> {c.hrm_recruiters.email}
                            </a>
                          )}
                          {c.hrm_recruiters.telefono && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--md-on-surface-variant)' }}>
                              <Phone size={12} /> {c.hrm_recruiters.telefono}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--md-on-surface-variant)' }}>
                          Bloqueado — ábrelo desde el directorio
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={status.cls}>{status.label}</span>
                    </td>
                    <td style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.8125rem' }}>
                      {c.fecha_contacto ? new Date(c.fecha_contacto).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.8125rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.notas || '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(c)} title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(c.id)} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                        {c.hrm_recruiters?.sitio_web && (
                          <a href={c.hrm_recruiters.sitio_web} target="_blank" rel="noreferrer" className="btn btn-ghost btn-icon btn-sm" title="Sitio web">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              {modal === 'new' ? 'Nuevo contacto' : `Editar: ${modal.hrm_recruiters?.nombre}`}
            </h2>

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {modal === 'new' && (
                <div className="input-group">
                  <label className="input-label">ID de reclutador</label>
                  <input
                    className="input"
                    placeholder="UUID del reclutador"
                    value={form.recruiter_id}
                    onChange={e => setForm(f => ({ ...f, recruiter_id: e.target.value }))}
                    required
                  />
                  <span className="input-error" style={{ color: 'var(--md-on-surface-variant)' }}>
                    Cópialo desde el directorio de reclutadores.
                  </span>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Estado</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="contactado">Contactado</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="respuesta">Con respuesta</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Fecha de contacto</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.fecha_contacto}
                  onChange={e => setForm(f => ({ ...f, fecha_contacto: e.target.value }))}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Notas</label>
                <textarea
                  className="input"
                  placeholder="Ej: Envié CV el lunes, esperando respuesta…"
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner spinner-sm" /> : null}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
