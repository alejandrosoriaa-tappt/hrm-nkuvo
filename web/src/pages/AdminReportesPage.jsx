import { useEffect, useState } from 'react'
import { DollarSign, ShoppingCart, Users, TrendingUp, Building2, Lock } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

export default function AdminReportesPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    hrmAPI.getAdminStats()
      .then(r => setStats(r.data))
      .catch(err => {
        if (err.response?.status === 403) setUnauthorized(true)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>
  }

  if (unauthorized || !stats) {
    return (
      <div className="empty-state">
        <Lock size={48} />
        <p style={{ fontWeight: 600 }}>No autorizado</p>
        <p style={{ fontSize: '0.875rem' }}>Esta página es solo para administradores.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analítica</h1>
          <p className="page-subtitle">Compras y planes reales, directo de la base de datos</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon={<DollarSign size={18} />} value={`$${stats.revenue.toLocaleString('es-MX')}`} label="Ingresos confirmados (MXN)" />
        <StatCard icon={<ShoppingCart size={18} />} value={stats.paidCount} label="Compras pagadas" />
        <StatCard icon={<TrendingUp size={18} />} value={stats.conversionRate != null ? `${stats.conversionRate}%` : '—'} label="Conversión checkout → pago" />
        <StatCard icon={<Users size={18} />} value={stats.activeBundles} label="Planes activos ahora" />
        <StatCard icon={<Building2 size={18} />} value={stats.totalRecruiters} label="Reclutadoras en directorio" />
      </div>

      <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '0.8125rem' }}>
          {stats.pendingCount} compra{stats.pendingCount === 1 ? '' : 's'} quedó/quedaron en "pendiente" (dejó el correo pero no completó el pago en Clip).
          Esto no mide visitas ni tráfico — para eso usa Meta Events Manager (filtra por content_name: "directorio").
        </span>
      </div>

      <div className="card">
        <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--md-on-surface)' }}>
          Últimas 20 compras
        </h2>
        {stats.recentPurchases.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)' }}>Sin compras todavía.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Correo</th><th>Estado</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {stats.recentPurchases.map((p, i) => (
                  <tr key={i}>
                    <td>{p.email}</td>
                    <td>
                      <span className={`chip ${p.status === 'paid' ? 'chip-success' : ''}`} style={{ fontSize: '0.6875rem' }}>
                        {p.status === 'paid' ? 'Pagado' : 'Pendiente'}
                      </span>
                    </td>
                    <td>{new Date(p.created_at).toLocaleString('es-MX')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function StatCard({ icon, value, label }) {
  return (
    <div className="card card-sm">
      <div style={{ color: 'var(--md-primary)', marginBottom: '0.5rem' }}>{icon}</div>
      <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-on-surface)', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginTop: '0.375rem' }}>{label}</p>
    </div>
  )
}
