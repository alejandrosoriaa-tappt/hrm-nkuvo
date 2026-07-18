import { ScanSearch, CheckCircle2 } from 'lucide-react'

export default function AtsExplainerPanel() {
  return (
    <div className="auth-info">
      <span className="chip chip-success" style={{ marginBottom: '0.75rem' }}>
        Gratis al crear tu cuenta
      </span>
      <h2 className="auth-info-title">
        Revisamos el formato de tu CV contra lo que buscan los ATS
      </h2>

      <div style={{
        display: 'flex', gap: '0.75rem', marginBottom: '0.875rem',
        background: 'var(--md-surface-container-low)', borderRadius: 12, padding: '0.875rem 1rem'
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-primary)', lineHeight: 1 }}>~98%</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: '0.25rem' }}>
            de las empresas grandes usan un ATS para filtrar CVs
          </p>
        </div>
        <div style={{ flex: 1, borderLeft: '1px solid var(--md-outline-variant)', paddingLeft: '0.75rem' }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-primary)', lineHeight: 1 }}>~75%</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: '0.25rem' }}>
            de los CVs son descartados por el ATS antes de llegar a una persona
          </p>
        </div>
      </div>

      <p className="auth-info-text">
        Un <strong>ATS (Applicant Tracking System)</strong> es el software que usan la mayoría
        de las empresas para recibir y filtrar CVs <em>antes</em> de que un reclutador los vea.
        Si el formato de tu CV no es compatible — tablas, columnas, contacto que no se puede
        leer, secciones sin nombres estándar — el sistema puede descartarlo automáticamente,
        aunque tengas el perfil ideal para el puesto.
      </p>
      <p className="auth-info-text">
        Por eso, gratis y sin necesidad de saber a qué vacante vas a aplicar, te decimos qué
        partes del formato de tu CV podrían estar bloqueándote antes de llegar a una persona:
      </p>
      <ul className="auth-info-list">
        {[
          'Secciones estándar (Experiencia, Educación, Habilidades)',
          'Correo y teléfono detectables como texto, no como imagen',
          'Sin tablas ni columnas múltiples que desordenan el contenido',
          'Longitud y fechas de experiencia legibles',
        ].map(item => (
          <li key={item}>
            <CheckCircle2 size={15} style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="auth-info-footer">
        <ScanSearch size={16} style={{ flexShrink: 0 }} />
        <span>El diagnóstico es gratis. Arreglarlo paso a paso con IA (y el LinkedIn Score) son parte del plan de $99 MXN / 30 días.</span>
      </div>
      <p style={{ fontSize: '0.6875rem', color: 'var(--md-on-surface-variant)', marginTop: '0.625rem' }}>
        Cifras de referencia de la industria de reclutamiento.
      </p>
    </div>
  )
}
