import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, Mail, MessageCircle, Lock, CreditCard } from 'lucide-react'
import { hrmAPI } from '../lib/api.js'

const TEMPLATES = [
  {
    id: 'primer-envio',
    title: 'Primer contacto',
    description: 'Para presentarte por primera vez a una reclutadora, con tu CV adjunto o el link de tu perfil.',
    channel: 'correo',
    subject: 'Interés en oportunidades — [Tu nombre]',
    body: `Hola [Nombre de la reclutadora],

Mi nombre es [Tu nombre] y vi que [Empresa] trabaja reclutamiento para el área de [industria/puesto]. Te escribo porque estoy buscando activamente nuevas oportunidades como [tu puesto/especialidad].

Adjunto mi CV — tengo [X años] de experiencia en [breve resumen de tu perfil]. Quedo atento por si en este momento o más adelante surge algo donde pueda encajar.

Quedo a tus órdenes para cualquier duda.

Saludos,
[Tu nombre]
[Tu teléfono]`,
  },
  {
    id: 'seguimiento',
    title: 'Seguimiento (primer recordatorio)',
    description: 'Unos 4-5 días después del primer contacto, si no ha habido respuesta.',
    channel: 'correo',
    subject: 'Seguimiento — [Tu nombre]',
    body: `Hola [Nombre de la reclutadora],

Espero se encuentre bien. Le escribí hace unos días para presentarme como candidato para oportunidades en [área/puesto] y quería dar seguimiento por si mi correo se traspapeló.

Sigo interesado y disponible. Le comparto de nuevo mi CV por si es de utilidad.

Quedo atento a sus comentarios.

Saludos,
[Tu nombre]`,
  },
  {
    id: 'fup',
    title: 'FUP — segundo y último recordatorio',
    description: 'Si después del primer seguimiento (1-2 semanas) sigue sin respuesta. Es tu último intento antes de dejarlo descansar.',
    channel: 'whatsapp',
    body: `Hola [Nombre], soy [Tu nombre] 👋 Te escribí hace unas semanas sobre oportunidades en [área/puesto] y no quería dejar de insistir una última vez por si hay algo donde pueda aportar.

Si por ahora no hay nada abierto, con gusto quedo en su radar para el futuro. ¡Gracias por su tiempo!`,
  },
  {
    id: 'agradecimiento',
    title: 'Agradecimiento post-entrevista',
    description: 'Mándalo el mismo día o al día siguiente de la entrevista, mientras la conversación sigue fresca.',
    channel: 'correo',
    subject: 'Gracias por la entrevista — [Tu nombre]',
    body: `Hola [Nombre de la reclutadora],

Muchas gracias por el tiempo de hoy y por la información compartida sobre [puesto/empresa]. Me quedo muy interesado en la posición, especialmente por [algo específico que se haya platicado].

Quedo atento a los siguientes pasos del proceso. Cualquier información adicional que necesiten de mi parte, con gusto la comparto.

Saludos y gracias de nuevo,
[Tu nombre]`,
  },
  {
    id: 'disponibilidad',
    title: 'Actualización de disponibilidad',
    description: 'Útil cuando ha pasado tiempo desde el último contacto y quieres reaparecer sin sonar a que estás desesperado.',
    channel: 'correo',
    subject: 'Sigo disponible — [Tu nombre]',
    body: `Hola [Nombre de la reclutadora],

Le escribo para comentarle que sigo activamente en búsqueda de nuevas oportunidades en [área/puesto]. Desde nuestro último contacto [agregué X experiencia / terminé X curso / etc. — opcional].

Si surge algo donde crea que puedo encajar, con gusto retomamos la conversación.

Saludos,
[Tu nombre]`,
  },
  {
    id: 'feedback',
    title: 'Solicitar feedback tras un "no"',
    description: 'Cuando te informan que no avanzas en el proceso. Pedir retroalimentación te ayuda a mejorar y deja una buena impresión.',
    channel: 'correo',
    subject: 'Gracias por la oportunidad — [Tu nombre]',
    body: `Hola [Nombre de la reclutadora],

Gracias por avisarme sobre el resultado del proceso para [puesto]. Aunque esta vez no fue posible avanzar, agradezco mucho la oportunidad y el tiempo invertido.

Si tiene un momento, le agradecería mucho cualquier retroalimentación sobre mi perfil o la entrevista — me ayudaría a seguir mejorando.

Quedo en contacto para futuras oportunidades.

Saludos,
[Tu nombre]`,
  },
]

export default function PlantillasPage() {
  const [copiedId, setCopiedId] = useState(null)
  const [isPro, setIsPro] = useState(null) // null = cargando

  useEffect(() => {
    hrmAPI.getSubscription()
      .then(r => setIsPro(r.data?.status === 'active'))
      .catch(() => setIsPro(false))
  }, [])

  const handleCopy = async (t) => {
    const text = t.subject
      ? `Asunto: ${t.subject}\n\n${t.body}`
      : t.body
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(t.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      alert('No se pudo copiar. Selecciona el texto manualmente.')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Plantillas</h1>
          <p className="page-subtitle">
            Mensajes listos para copiar y mandar desde tu propio correo o WhatsApp —
            HRM NKUVO nunca envía nada en automático a nombre tuyo.
          </p>
        </div>
      </div>

      {isPro === false && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem', maxWidth: 640, flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
          <p style={{ fontSize: '0.8125rem' }}>
            Las plantillas completas son parte del plan Pro. Suscríbete para desbloquear el texto y copiarlo.
          </p>
          <Link to="/app/membresia" className="btn btn-primary btn-sm">
            <CreditCard size={13} /> Suscribirme
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 640 }}>
        {TEMPLATES.map(t => (
          <div key={t.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  {t.channel === 'whatsapp'
                    ? <MessageCircle size={14} style={{ color: 'var(--md-primary)' }} />
                    : <Mail size={14} style={{ color: 'var(--md-primary)' }} />}
                  <h2 style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--md-on-surface)' }}>{t.title}</h2>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--md-on-surface-variant)' }}>{t.description}</p>
              </div>

              {isPro ? (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleCopy(t)}
                  style={{ flexShrink: 0 }}
                >
                  {copiedId === t.id
                    ? <><Check size={14} /> Copiado</>
                    : <><Copy size={14} /> Copiar</>}
                </button>
              ) : (
                <Link to="/app/membresia" className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
                  <Lock size={14} /> Suscribirme
                </Link>
              )}
            </div>

            {isPro ? (
              <>
                {t.subject && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--md-on-surface-variant)', marginBottom: '0.5rem' }}>
                    <strong>Asunto:</strong> {t.subject}
                  </p>
                )}
                <pre style={{
                  fontFamily: 'inherit',
                  fontSize: '0.8125rem',
                  color: 'var(--md-on-surface)',
                  whiteSpace: 'pre-wrap',
                  background: 'var(--md-surface-container-low)',
                  borderRadius: 10,
                  padding: '0.875rem',
                  margin: 0,
                  lineHeight: 1.6,
                }}>
                  {t.body}
                </pre>
              </>
            ) : (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
                <pre style={{
                  fontFamily: 'inherit',
                  fontSize: '0.8125rem',
                  color: 'var(--md-on-surface)',
                  whiteSpace: 'pre-wrap',
                  background: 'var(--md-surface-container-low)',
                  borderRadius: 10,
                  padding: '0.875rem',
                  margin: 0,
                  lineHeight: 1.6,
                  filter: 'blur(5px)',
                  userSelect: 'none',
                }}>
                  {t.body}
                </pre>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600,
                  color: 'var(--md-on-surface-variant)',
                }}>
                  <Lock size={14} /> Disponible con plan Pro
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
