import { Link } from 'react-router-dom'

export default function MetodologiaLinkedInPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--md-surface-container-low)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.25rem 4rem' }}>
        <Link to="/app" style={{ fontSize: '0.8125rem', color: 'var(--md-primary)', fontWeight: 500 }}>
          ← Volver
        </Link>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-on-surface)', marginTop: '1rem' }}>
          📎 Metodología del Score de LinkedIn
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginTop: '0.25rem' }}>
          Última actualización: 18 de julio de 2026 · hrm.nkuvo.com
        </p>

        <div className="card" style={{ marginTop: '1.5rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
          <p>
            <strong>Resumen:</strong> El score mide qué tan <em>completo</em> está tu perfil y qué tan bien sigue
            las buenas prácticas de estructura que documenta la propia LinkedIn y que reportan reclutadores.
            <strong> No mide, ni puede medir, cómo te va a rankear el algoritmo de búsqueda real de LinkedIn</strong> —
            esa fórmula es privada y no la conoce nadie fuera de LinkedIn, ni nosotros ni ninguna otra herramienta
            que ofrezca un "LinkedIn score".
          </p>
        </div>

        <Section title="1. De dónde salen los criterios">
          <p>Usamos tres tipos de fuente, y marcamos claramente cuál es cuál en cada check:</p>
          <Table
            head={['Fuente', 'Qué tan oficial es', 'Qué usamos de ahí']}
            rows={[
              [
                '"All-Star" / completitud de perfil de LinkedIn',
                'Oficial — documentado públicamente por LinkedIn',
                'Foto, ubicación, industria, resumen, puesto actual, 2+ puestos anteriores, educación, 5+ habilidades, 50+ contactos',
              ],
              [
                'Social Selling Index (SSI)',
                'Oficial, pero pensado para ventas, no para reclutamiento',
                'La idea de sus 4 ejes (marca profesional, encontrar personas correctas, generar interacción, construir relaciones) — no el número exacto de SSI',
              ],
              [
                'Buenas prácticas de reclutamiento',
                'Consenso de la industria, no un estándar verificable',
                'Ej. titular con palabras clave del puesto que buscas, resumen con logros cuantificados, estructura legible',
              ],
            ]}
          />
        </Section>

        <Section title="2. Qué SÍ calificamos (gratis, heurístico)">
          <p>
            Esta parte del score es automática, basada en reglas objetivas — no usa IA. Es el mismo tipo de check
            que ya usamos en el ATS Checker de CV, aplicado a tu perfil de LinkedIn:
          </p>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
            <li>Foto de perfil presente</li>
            <li>Titular ("headline") con contenido, no solo tu puesto genérico</li>
            <li>Sección "Acerca de" con longitud razonable</li>
            <li>Al menos 2 experiencias con fechas</li>
            <li>Educación registrada</li>
            <li>5 o más aptitudes/habilidades</li>
            <li>Ubicación e industria configuradas</li>
          </ul>
        </Section>

        <Section title="3. Qué califica la IA (Pro / pack), y con qué límite">
          <p>
            Cuando eliges una industria, usamos Claude (Anthropic) para revisar tu titular y resumen contra el
            lenguaje que suelen buscar reclutadores de esa industria, y para sugerir mejoras de redacción. Esto es
            una <strong>opinión experta generada por IA</strong>, comparable a la de un coach de carrera — no una
            simulación del algoritmo de LinkedIn ni una garantía de mejores resultados.
          </p>
        </Section>

        <Section title="4. Qué NO podemos saber ni prometer">
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <li>Los pesos reales del algoritmo de búsqueda/ranking de LinkedIn (no son públicos)</li>
            <li>Cómo filtra un reclutador específico en LinkedIn Recruiter (su producto pagado, con criterios propios de cada empresa)</li>
            <li>Que un score alto se traduzca en más mensajes de reclutadores — depende de muchos factores fuera de tu perfil</li>
          </ul>
        </Section>

        <Section title="5. Cómo leemos tu perfil">
          <p>
            No accedemos a tu cuenta de LinkedIn ni la "scrapeamos" — eso viola los términos de uso de LinkedIn.
            Tú exportas tu propio perfil como PDF (desde LinkedIn: "Más" → "Guardar en PDF") y lo subes aquí, o
            pegas el texto directamente. El análisis corre sobre ese contenido que tú nos das.
          </p>
        </Section>

        <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginTop: '2rem', textAlign: 'center' }}>
          ¿Encontraste un criterio que crees que está mal fundamentado? Escríbenos a{' '}
          <a href="mailto:hola@nkuvo.com" style={{ color: 'var(--md-primary)' }}>hola@nkuvo.com</a>.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--md-on-surface)', marginBottom: '0.5rem' }}>{title}</h2>
      <div style={{ fontSize: '0.875rem', color: 'var(--md-on-surface-variant)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function Table({ head, rows }) {
  return (
    <div className="table-wrap">
      <table className="table">
        {head && (
          <thead>
            <tr>{head.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
