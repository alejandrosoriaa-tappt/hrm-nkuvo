import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ExternalLink, Plus, MessageCircle, Globe, Phone, Mail, CreditCard, Lock } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

export default function ReclutadorasPage() {
  const navigate = useNavigate()
  const [recruiters, setRecruiters] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [sub, setSub] = useState(null)
  const [addingContact, setAddingContact] = useState(false)

  useEffect(() => {
    Promise.all([hrmAPI.listRecruiters(), hrmAPI.getSubscription()])
      .then(([r, s]) => {
        setRecruiters(r.data || [])
        setSub(s.data || { status: 'free' })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = recruiters.filter(r =>
    !search ||
    r.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    r.industria?.toLowerCase().includes(search.toLowerCase()) ||
    r.ciudad?.toLowerCase().includes(search.toLowerCase())
  )

  const openDetail = async (r) => {
    setSelected({ ...r, _loading: true })
    setDetailLoading(true)
    try {
      const full = await hrmAPI.getRecruiter(r.id)
      setSelected(full.data)
    } catch {
      setSelected(r)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleAddContact = async () => {
    if (!selected) return
    setAddingContact(true)
    try {
      await hrmAPI.createContact({ recruiter_id: selected.id })
      alert('Reclutador agregado a tus contactos.')
    } catch (err) {
      if (err.response?.data?.locked) {
        navigate('/app/membresia')
        return
      }
      alert(err.response?.data?.error || err.message)
    } finally {
      setAddingContact(false)
    }
  }

  // El backend marca _contactLocked cuando ya no quedan desbloqueos gratis
  // y el usuario no es Pro — úsalo para bloquear también "Agregar a
  // seguimiento" en vez de solo inferir del email/telefono presentes.
  const isLocked = selected?._contactLocked === true
  const hasContact = selected && (selected.email || selected.telefono)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Directorio de reclutadores</h1>
          <p className="page-subtitle">
            {sub?.status !== 'active'
              ? 'Plan gratuito: datos de contacto disponibles para los primeros 5 reclutadores'
              : 'Plan Pro: acceso completo a todos los datos de contacto'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Lista */}
        <div>
          {/* Buscador */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--md-on-surface-variant)' }} />
            <input
              className="input"
              placeholder="Buscar por nombre, industria o ciudad…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p>Sin resultados para "{search}"</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Industria</th>
                    <th>Ciudad</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                      <td style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.8125rem' }}>
                        {r.industria || '—'}
                      </td>
                      <td style={{ color: 'var(--md-on-surface-variant)', fontSize: '0.8125rem' }}>
                        {r.ciudad || '—'}
                      </td>
                      <td>
                        {r.sitio_web && (
                          <a href={r.sitio_web} target="_blank" rel="noreferrer"
                             className="btn btn-ghost btn-icon btn-sm"
                             onClick={e => e.stopPropagation()}
                             title="Sitio web">
                            <Globe size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '0.75rem' }}>
            {filtered.length} de {recruiters.length} reclutadores
          </p>
        </div>

        {/* Panel de detalle */}
        {selected && (
          <div className="card" style={{ position: 'sticky', top: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--md-on-surface)' }}>{selected.nombre}</h2>
                {selected.industria && <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>{selected.industria}</p>}
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            {detailLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
                <div className="spinner spinner-sm" />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {selected.ciudad && (
                    <InfoRow icon="📍" text={selected.ciudad} />
                  )}
                  {selected.sitio_web && (
                    <InfoRow icon={<Globe size={14} />}>
                      <a href={selected.sitio_web} target="_blank" rel="noreferrer"
                         style={{ color: 'var(--md-primary)', fontSize: '0.8125rem' }}>
                        {selected.sitio_web.replace(/^https?:\/\//, '')}
                      </a>
                    </InfoRow>
                  )}
                  {selected.email ? (
                    <InfoRow icon={<Mail size={14} />}>
                      <a href={`mailto:${selected.email}`} style={{ color: 'var(--md-primary)', fontSize: '0.8125rem' }}>
                        {selected.email}
                      </a>
                    </InfoRow>
                  ) : (
                    <div className="alert alert-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}>
                      <span>Contacto disponible para primeros 5 reclutadores o con plan Pro</span>
                      {sub?.status !== 'active' && (
                        <Link to="/app/membresia" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                          <CreditCard size={13} /> Suscribirme
                        </Link>
                      )}
                    </div>
                  )}
                  {selected.telefono && (
                    <InfoRow icon={<Phone size={14} />}>
                      <span style={{ fontSize: '0.8125rem' }}>{selected.telefono}</span>
                    </InfoRow>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {isLocked ? (
                    <Link to="/app/membresia" className="btn btn-primary btn-sm w-full">
                      <Lock size={14} />
                      Suscribirme para agregar
                    </Link>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm w-full"
                      onClick={handleAddContact}
                      disabled={addingContact}
                    >
                      <Plus size={15} />
                      {addingContact ? 'Agregando…' : 'Agregar a seguimiento'}
                    </button>
                  )}

                  {selected.telefono && (
                    <a
                      href={`https://wa.me/${selected.telefono.replace(/\D/g,'')}`}
                      target="_blank" rel="noreferrer"
                      className="btn btn-outline btn-sm w-full"
                    >
                      <MessageCircle size={15} />
                      WhatsApp
                    </a>
                  )}

                  {selected.email && (
                    <a
                      href={`mailto:${selected.email}`}
                      className="btn btn-ghost btn-sm w-full"
                    >
                      <Mail size={15} />
                      Enviar correo
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function InfoRow({ icon, text, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ color: 'var(--md-on-surface-variant)', flexShrink: 0 }}>{icon}</span>
      {children || <span style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface)' }}>{text}</span>}
    </div>
  )
}
