import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, Pencil, Trash2 } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const EMPTY_FORM = {
  descripcion: '',
  fecha_cita: new Date().toISOString().slice(0, 16),
  recruiter_id: '',
}

export default function CalendarioPage() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [today] = useState(new Date())
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)

  const load = () => {
    hrmAPI.listAppointments()
      .then(r => setAppointments(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Celdas del calendario para el mes actual
  const calendarCells = () => {
    const { year, month } = cursor
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrev = new Date(year, month, 0).getDate()

    const cells = []
    // días del mes anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrev - i, currentMonth: false, date: null })
    }
    // días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, currentMonth: true, date: new Date(year, month, d) })
    }
    // completar hasta 42 celdas
    let next = 1
    while (cells.length < 42) {
      cells.push({ day: next++, currentMonth: false, date: null })
    }
    return cells
  }

  const apptsByDay = appointments.reduce((acc, a) => {
    const d = new Date(a.fecha_cita)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    ;(acc[key] = acc[key] || []).push(a)
    return acc
  }, {})

  const isToday = (date) =>
    date &&
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  const dayKey = (date) =>
    date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : ''

  const prevMonth = () =>
    setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 })

  const nextMonth = () =>
    setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 })

  const openNew = (date) => {
    const fecha = date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate(),
          today.getHours(), today.getMinutes()).toISOString().slice(0, 16)
      : EMPTY_FORM.fecha_cita
    setForm({ ...EMPTY_FORM, fecha_cita: fecha })
    setModal('new')
    setError(null)
  }

  const openEdit = (a) => {
    setForm({ descripcion: a.descripcion || '', fecha_cita: a.fecha_cita?.slice(0, 16), recruiter_id: a.recruiter_id || '' })
    setModal(a)
    setError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = { descripcion: form.descripcion, fecha_cita: form.fecha_cita }
      if (form.recruiter_id) payload.recruiter_id = form.recruiter_id
      if (modal === 'new') {
        await hrmAPI.createAppointment(payload)
      } else {
        await hrmAPI.updateAppointment(modal.id, payload)
      }
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (a) => {
    try {
      await hrmAPI.updateAppointment(a.id, { completado: !a.completado })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const cells = calendarCells()

  // Próximas citas (sidebar)
  const upcoming = appointments
    .filter(a => !a.completado && new Date(a.fecha_cita) >= new Date())
    .sort((a, b) => new Date(a.fecha_cita) - new Date(b.fecha_cita))
    .slice(0, 5)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendario</h1>
          <p className="page-subtitle">Tus citas con reclutadores</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openNew(null)}>
          <Plus size={15} /> Nueva cita
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Calendario */}
        <div className="card" style={{ padding: '1rem' }}>
          {/* Nav mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={prevMonth}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
              {MONTHS[cursor.month]} {cursor.year}
            </span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={nextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="calendar-grid">
            {DAYS.map(d => (
              <div key={d} className="calendar-header-day">{d}</div>
            ))}

            {/* Celdas */}
            {cells.map((cell, i) => {
              const appts = cell.date ? (apptsByDay[dayKey(cell.date)] || []) : []
              return (
                <div
                  key={i}
                  className={`calendar-day${!cell.currentMonth ? ' other-month' : ''}${isToday(cell.date) ? ' today' : ''}`}
                  onClick={() => cell.currentMonth && (setSelectedDay(cell.date), openNew(cell.date))}
                  style={{ cursor: cell.currentMonth ? 'pointer' : 'default' }}
                >
                  <div className="calendar-day-num">{cell.day}</div>
                  {appts.slice(0, 2).map(a => (
                    <div
                      key={a.id}
                      className="calendar-event"
                      title={a.descripcion}
                      onClick={e => { e.stopPropagation(); openEdit(a) }}
                      style={a.completado ? { opacity: 0.5, textDecoration: 'line-through' } : {}}
                    >
                      {a.descripcion || a.hrm_recruiters?.nombre || 'Cita'}
                    </div>
                  ))}
                  {appts.length > 2 && (
                    <div style={{ fontSize: '0.6rem', color: 'var(--md-on-surface-variant)', marginTop: 2 }}>
                      +{appts.length - 2} más
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar de próximas citas */}
        <div>
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--md-on-surface)' }}>
              Próximas citas
            </h3>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                <div className="spinner spinner-sm" />
              </div>
            ) : upcoming.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', textAlign: 'center', padding: '1rem 0' }}>
                Sin citas próximas
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcoming.map(a => (
                  <div key={a.id} style={{ borderLeft: '3px solid var(--md-primary)', paddingLeft: '0.75rem' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 2 }}>
                      {a.descripcion || a.hrm_recruiters?.nombre || 'Cita'}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)' }}>
                      {new Date(a.fecha_cita).toLocaleString('es-MX', {
                        dateStyle: 'medium', timeStyle: 'short'
                      })}
                    </p>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.375rem' }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 9999 }} onClick={() => handleToggle(a)}>
                        <Check size={12} /> Marcar hecha
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(a)}>
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal nueva/editar cita */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              {modal === 'new' ? 'Nueva cita' : 'Editar cita'}
            </h2>

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Descripción</label>
                <input
                  className="input"
                  placeholder="Ej: Entrevista con RRHH - Empresa X"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Fecha y hora</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.fecha_cita}
                  onChange={e => setForm(f => ({ ...f, fecha_cita: e.target.value }))}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">ID de reclutador (opcional)</label>
                <input
                  className="input"
                  placeholder="UUID del reclutador"
                  value={form.recruiter_id}
                  onChange={e => setForm(f => ({ ...f, recruiter_id: e.target.value }))}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
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
