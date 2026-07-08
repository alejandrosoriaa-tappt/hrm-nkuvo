import { StickyNote, Plus } from 'lucide-react'

export default function NotasPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notas</h1>
          <p className="page-subtitle">Apuntes sobre tu búsqueda de empleo</p>
        </div>
        <button className="btn btn-primary btn-sm" disabled>
          <Plus size={15} /> Nueva nota
        </button>
      </div>

      <div className="empty-state">
        <StickyNote size={48} />
        <p style={{ fontWeight: 600 }}>Próximamente</p>
        <p style={{ fontSize: '0.875rem' }}>
          Espacio de notas libres: consejos, preguntas de entrevista, preparación de reuniones.
        </p>
      </div>
    </>
  )
}
