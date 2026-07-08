import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

export default function ReportesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      hrmAPI.listContacts(),
      hrmAPI.listAppointments(),
      hrmAPI.listCvs(),
    ]).then(([contacts, appts, cvs]) => {
      const c = contacts.data || []
      const a = appts.data || []
      const v = cvs.data || []

      const byStatus = c.reduce((acc, x) => {
        acc[x.status] = (acc[x.status] || 0) + 1
        return acc
      }, {})

      // Actividad por mes (últimos 6)
      const now = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('es-MX', { month: 'short' }) }
      })

      const monthlyContacts = months.map(m =>
        c.filter(x => {
          const d = new Date(x.fecha_contacto)
          return d.getFullYear() === m.year && d.getMonth() === m.month
        }).length
      )

      setData({ byStatus, byMonth: { labels: months.map(m => m.label), values: monthlyContacts }, totalCvs: v.length, totalAppts: a.length })
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>
  }

  const maxVal = Math.max(...(data?.byMonth?.values || [1]), 1)
  const statusEntries = [
    ['contactado',  'Contactado',    'var(--md-outline)'],
    ['en_proceso',  'En proceso',    'var(--md-primary)'],
    ['respuesta',   'Con respuesta', '#15803D'],
    ['descartado',  'Descartado',    'var(--md-error)'],
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Resumen de tu actividad de búsqueda</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* Actividad mensual */}
        <div className="card">
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1.25rem', color: 'var(--md-on-surface)' }}>
            Nuevos contactos por mes
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 120 }}>
            {data?.byMonth?.labels.map((label, i) => {
              const val = data.byMonth.values[i]
              const pct = (val / maxVal) * 100
              return (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)' }}>{val}</span>
                  <div style={{
                    width: '100%', borderRadius: '6px 6px 0 0',
                    background: 'var(--md-primary)',
                    height: `${Math.max(pct, 4)}%`,
                    opacity: val === 0 ? 0.25 : 1
                  }} />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)' }}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Por status */}
        <div className="card">
          <h2 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '1rem', color: 'var(--md-on-surface)' }}>
            Contactos por estado
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {statusEntries.map(([key, label, color]) => {
              const val = data?.byStatus?.[key] || 0
              const total = Object.values(data?.byStatus || {}).reduce((a, b) => a + b, 0) || 1
              const pct = Math.round((val / total) * 100)
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--md-on-surface-variant)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--md-on-surface)' }}>{val} ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--md-surface-container)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
