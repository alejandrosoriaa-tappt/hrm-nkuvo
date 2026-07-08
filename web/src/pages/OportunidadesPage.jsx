import { Briefcase, Plus } from 'lucide-react'

export default function OportunidadesPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Oportunidades</h1>
          <p className="page-subtitle">Vacantes y procesos activos que estás siguiendo</p>
        </div>
        <button className="btn btn-primary btn-sm" disabled>
          <Plus size={15} /> Nueva oportunidad
        </button>
      </div>

      <div className="empty-state">
        <Briefcase size={48} />
        <p style={{ fontWeight: 600 }}>Próximamente</p>
        <p style={{ fontSize: '0.875rem' }}>
          Lleva un pipeline de vacantes: empresa, puesto, salario esperado y status del proceso.
        </p>
      </div>
    </>
  )
}
