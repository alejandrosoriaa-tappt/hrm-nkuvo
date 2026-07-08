import { useEffect, useState } from 'react'
import { Users, Building2, CalendarDays, FileText, TrendingUp } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

export default function ResumenPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState(null)

  useEffect(() => {
    Promise.all([
      hrmAPI.listContacts(),
      hrmAPI.listAppointments(),
      hrmAPI.listCvs(),
      hrmAPI.getSubscription(),
    ]).then(([contacts, appts, cvs, subscription]) => {
      const contactsData = contacts.data || []
      const apptData = appts.data || []

      // Citas próximas (hoy en adelante, no completadas)
      const upcoming = apptData.filter(a =>
        !a.completado && new Date(a.fecha_cita) >= new Date()
      ).length

      // Distribución por status de contacto
      const byStatus = contactsData.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1
        return acc
      }, {})

      setStats({
        totalContactos: contactsData.length,
        proximas: upcoming,
        totalCvs: (cvs.data || []).length,
        byStatus,
      })
      setSub(subscription.data || { status: 'free' })
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <div className="spinner" />
      </div>
    )
  }

  const planLabel = sub?.status === 'active' ? 'Pro' : 'Gratuito'
  const planChipClass = sub?.status === 'active' ? 'chip chip-primary' : 'chip'

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen</h1>
          <p className="page-subtitle">Tu actividad de búsqueda de empleo</p>
        </div>
        <span className={planChipClass}>Plan {planLabel}</span>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon={<Users size={20} />}
          value={stats?.totalContactos ?? 0}
          label="Reclutadoras contactadas"
        />
        <StatCard
          icon={<CalendarDays size={20} />}
          value={stats?.proximas ?? 0}
          label="Citas próximas"
        />
        <StatCard
          icon={<FileText size={20} />}
          value={stats?.totalCvs ?? 0}
          label="Variantes de CV"
          max={5}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          value={stats?.byStatus?.en_proceso ?? 0}
          label="En proceso"
        />
      </div>

      {/* Distribución de contactos */}
      {stats?.totalContactos > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--md-on-surface)' }}>
            Estado de tus contactos
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <StatusPill label="Contactado"  count={stats.byStatus.contactado  || 0} color="var(--md-outline-variant)" />
            <StatusPill label="En proceso"  count={stats.byStatus.en_proceso  || 0} color="var(--md-primary)" />
            <StatusPill label="Con respuesta" count={stats.byStatus.respuesta || 0} color="#15803D" />
            <StatusPill label="Descartado"  count={stats.byStatus.descartado  || 0} color="var(--md-error)" />
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--md-on-surface)' }}>
          Acciones rápidas
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a href="/app/reclutadoras" className="btn btn-primary btn-sm">
            <Building2 size={15} /> Explorar directorio
          </a>
          <a href="/app/contactos" className="btn btn-outline btn-sm">
            <Users size={15} /> Ver seguimiento
          </a>
          <a href="/app/cvs" className="btn btn-outline btn-sm">
            <FileText size={15} /> Subir CV
          </a>
          <a href="/app/calendario" className="btn btn-outline btn-sm">
            <CalendarDays size={15} /> Agendar cita
          </a>
        </div>
      </div>

      {/* Freemium nudge */}
      {sub?.status !== 'active' && (
        <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
          <TrendingUp size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            Tienes <strong>5 contactos con datos completos</strong> en el plan gratuito.
            Para desbloquear más, actualiza a Pro por $299 MXN/mes.
          </span>
        </div>
      )}
    </>
  )
}

function StatCard({ icon, value, label, max }) {
  return (
    <div className="stat-card">
      <div style={{ color: 'var(--md-primary)', marginBottom: '0.5rem' }}>{icon}</div>
      <div className="stat-value">
        {value}{max ? <span style={{ fontSize: '1rem', color: 'var(--md-on-surface-variant)' }}>/{max}</span> : ''}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function StatusPill({ label, count, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem 1rem', borderRadius: '9999px',
      background: 'var(--md-surface-container)', fontSize: '0.8125rem'
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: 'var(--md-on-surface-variant)' }}>{label}</span>
      <strong style={{ color: 'var(--md-on-surface)' }}>{count}</strong>
    </div>
  )
}
