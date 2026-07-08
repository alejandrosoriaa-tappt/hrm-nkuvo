import { Tag, Plus } from 'lucide-react'

export default function EtiquetasPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Etiquetas</h1>
          <p className="page-subtitle">Organiza reclutadoras y contactos por categorías</p>
        </div>
        <button className="btn btn-primary btn-sm" disabled>
          <Plus size={15} /> Nueva etiqueta
        </button>
      </div>

      <div className="empty-state">
        <Tag size={48} />
        <p style={{ fontWeight: 600 }}>Próximamente</p>
        <p style={{ fontSize: '0.875rem' }}>
          Crea etiquetas como "IT", "Finanzas", "Headhunter top" y asígnalas a tus contactos.
        </p>
      </div>
    </>
  )
}
