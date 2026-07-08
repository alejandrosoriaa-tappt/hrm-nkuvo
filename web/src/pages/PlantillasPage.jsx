import { BookTemplate, Plus } from 'lucide-react'

export default function PlantillasPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Plantillas</h1>
          <p className="page-subtitle">Correos y mensajes reutilizables</p>
        </div>
        <button className="btn btn-primary btn-sm" disabled>
          <Plus size={15} /> Nueva plantilla
        </button>
      </div>

      <div className="empty-state">
        <BookTemplate size={48} />
        <p style={{ fontWeight: 600 }}>Próximamente</p>
        <p style={{ fontSize: '0.875rem' }}>
          Aquí podrás guardar plantillas de correos de presentación, follow-up y más.
        </p>
      </div>
    </>
  )
}
