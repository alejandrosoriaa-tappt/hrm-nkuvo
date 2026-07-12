import { Link } from 'react-router-dom'

const WA_SUPPORT = 'https://wa.me/5215658732336'

export default function PrivacidadPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--md-surface-container-low)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.25rem 4rem' }}>
        <Link to="/directorio" style={{ fontSize: '0.8125rem', color: 'var(--md-primary)', fontWeight: 500 }}>
          ← Volver
        </Link>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-on-surface)', marginTop: '1rem' }}>
          🔒 Aviso de Privacidad
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginTop: '0.25rem' }}>
          Última actualización: 12 de julio de 2026 · hrm.nkuvo.com
        </p>

        <div className="card" style={{ marginTop: '1.5rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
          <p>
            <strong>Resumen:</strong> HRM NKUVO recopila tu correo, tu CV (si lo subes) y los datos de las
            reclutadoras que registras como contactadas, para prestarte el servicio. No vendemos tu información.
            Puedes pedir la eliminación de tus datos escribiéndonos a{' '}
            <a href="mailto:privacidad@nkuvo.com" style={{ color: 'var(--md-primary)' }}>privacidad@nkuvo.com</a>{' '}
            o por WhatsApp.
          </p>
        </div>

        <Section title="1. Responsable">
          <p>
            HRM NKUVO es un servicio de <strong>NKUVO IDEAS SAS DE CV</strong>, representada por Alejandro Soria A.,
            con domicilio en los Estados Unidos Mexicanos.
          </p>
          <p style={{ marginTop: '0.5rem' }}>Sitio web: hrm.nkuvo.com</p>
          <p>Contacto de privacidad: <a href="mailto:privacidad@nkuvo.com" style={{ color: 'var(--md-primary)' }}>privacidad@nkuvo.com</a></p>
          <p style={{ marginTop: '0.5rem' }}>Cumplimos la LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).</p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <Table
            head={['Dato', 'Origen', 'Obligatorio']}
            rows={[
              ['Correo electrónico', 'Al crear tu cuenta o comprar el directorio', 'Sí'],
              ['Contraseña (cifrada)', 'Al crear tu cuenta', 'Sí, si usas la app'],
              ['Teléfono', 'Si lo agregas en Configuración', 'No'],
              ['CV (archivo)', 'Al subirlo para el ATS Checker', 'Para usar el checker'],
              ['Reclutadoras contactadas y notas', 'Las que tú registras', 'Para el servicio'],
              ['Citas con reclutadoras', 'Las que tú agendas', 'Para el servicio'],
              ['Datos de pago', 'Clip (nosotros no los almacenamos)', 'Solo al comprar o suscribirte'],
              ['Correo de compra del directorio ($99)', 'Al comprar sin cuenta', 'Solo para esa compra'],
            ]}
          />
        </Section>

        <Section title="3. Finalidades">
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <li>📌 Directorio de reclutadoras y seguimiento de tus contactos</li>
            <li>📄 Diagnóstico y mejora de tu CV (ATS Checker)</li>
            <li>📅 Agenda de citas y recordatorios — incluye notificación por WhatsApp vía Tappt, solo si agendas una cita con una reclutadora</li>
            <li>💳 Gestión de pagos y suscripciones</li>
            <li>🔧 Mejora del servicio (análisis anónimo)</li>
          </ul>
          <p style={{ marginTop: '0.5rem' }}>No usamos tus datos para publicidad de terceros ni los vendemos.</p>
        </Section>

        <Section title="4. Terceros que procesan tus datos">
          <Table
            head={['Proveedor', 'Propósito']}
            rows={[
              ['Supabase', 'Base de datos, autenticación y almacenamiento de CVs'],
              ['Anthropic (Claude AI)', 'Diagnóstico ATS y sugerencias de reescritura de CV'],
              ['Clip', 'Procesamiento de pagos'],
              ['Meta / WhatsApp (vía Tappt)', 'Notificación de citas, solo si agendas con una reclutadora'],
              ['Railway', 'Infraestructura y hosting'],
            ]}
          />
        </Section>

        <Section title="5. Retención">
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <li>Cuenta: mientras tengas el servicio activo + 6 meses</li>
            <li>CVs: hasta que los elimines o cierres tu cuenta (máximo 5 archivos por cuenta)</li>
            <li>Citas y contactos: 12 meses tras la fecha, o hasta que los elimines</li>
            <li>Compra del directorio ($99, sin cuenta): tu correo se conserva para soporte de esa compra; el link de descarga es de un solo uso</li>
          </ul>
        </Section>

        <Section title="6. Seguridad">
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <li>🔐 HTTPS / TLS en todas las comunicaciones</li>
            <li>🗄️ Row-Level Security en base de datos — cada usuario solo ve sus propios datos</li>
            <li>🔑 Credenciales cifradas como variables de entorno</li>
            <li>🔒 Un solo dispositivo activo por cuenta a la vez</li>
          </ul>
        </Section>

        <Section title="7. Derechos ARCO">
          <p>
            Tienes derecho de Acceso, Rectificación, Cancelación y Oposición sobre tus datos. Escríbenos a{' '}
            <a href="mailto:privacidad@nkuvo.com" style={{ color: 'var(--md-primary)' }}>privacidad@nkuvo.com</a>{' '}
            o por{' '}
            <a href={WA_SUPPORT} target="_blank" rel="noreferrer" style={{ color: 'var(--md-primary)' }}>WhatsApp</a>.
            Respondemos en máximo 20 días hábiles.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            Usamos únicamente cookies y almacenamiento técnico esencial (sesión de la app). No usamos cookies
            publicitarias ni de rastreo de terceros.
          </p>
        </Section>

        <Section title="9. Cambios">
          <p>
            Si hay cambios significativos a este aviso te avisaremos dentro de la app. La fecha de actualización
            siempre aparece al inicio de esta página.
          </p>
        </Section>

        <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)', marginTop: '2rem', textAlign: 'center' }}>
          🇲🇽 Ley aplicable: Estados Unidos Mexicanos. Jurisdicción: Ciudad de México.
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
