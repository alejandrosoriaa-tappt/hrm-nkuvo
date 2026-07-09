import axios from 'axios'

// Conector HRM → Tappt (misma estructura que nkuvo-crm-backend/src/services/tappt.js).
//
// Diferencia B2C vs CRM: notify_to = teléfono del candidato.
// Confirmación al crear cita: SIEMPRE use_template (plantilla Meta), porque
// usuarios nuevos no tienen ventana 24h abierta y el texto libre no llega.
//
// Variables de entorno (Railway HRM):
//   TAPPT_API_URL — https://www.tappt.lat
//   TAPPT_API_KEY  — API key compartida con Tappt

const TAPPT_API_URL = process.env.TAPPT_API_URL
const TAPPT_API_KEY = process.env.TAPPT_API_KEY

/** Días sin interacción WA para forzar template de Meta. */
export const TAPPT_TEMPLATE_IDLE_DAYS = 14

export function tapptEnabled() {
  return Boolean(TAPPT_API_URL && TAPPT_API_KEY)
}

/**
 * Normaliza a formato WhatsApp México: 521 + 10 dígitos.
 */
export function normalizeMexicoPhone(raw) {
  if (raw == null || raw === '') return null
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.length === 13 && digits.startsWith('521')) return digits
  if (digits.length === 12 && digits.startsWith('52')) return `521${digits.slice(2)}`
  if (digits.length === 11 && digits.startsWith('1')) return `52${digits}`
  if (digits.length === 10) return `521${digits}`
  if (digits.length >= 12 && digits.startsWith('52')) return digits
  return null
}

/**
 * ¿Hace falta plantilla Meta? (usuario nuevo o sin WA en >14 días)
 *
 * Criterios (cualquiera → template):
 * - No hay last_tappt_wa_at en metadata y no hay citas previas
 * - last_tappt_wa_at o última cita previa es más antigua que 14 días
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} currentAppointmentId — cita recién creada (excluida del historial)
 * @param {string|null} lastTapptWaAt — user_metadata.last_tappt_wa_at
 */
export async function candidateNeedsWaTemplate(
  supabase,
  userId,
  currentAppointmentId,
  lastTapptWaAt = null
) {
  const idleMs = TAPPT_TEMPLATE_IDLE_DAYS * 24 * 60 * 60 * 1000
  const now = Date.now()

  if (lastTapptWaAt) {
    const t = new Date(lastTapptWaAt).getTime()
    if (!Number.isNaN(t)) {
      return now - t >= idleMs
    }
  }

  const { data: prev, error } = await supabase
    .from('hrm_appointments')
    .select('id, created_at')
    .eq('user_id', userId)
    .neq('id', currentAppointmentId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('Tappt needsTemplate: error leyendo citas previas → usar template', error.message)
    return true
  }

  // Sin citas previas = primer contacto
  if (!prev?.length) return true

  const lastAt = new Date(prev[0].created_at).getTime()
  if (Number.isNaN(lastAt)) return true
  return now - lastAt >= idleMs
}

/** Formatea fecha_cita ISO → { dateStr, timeStr } en CDMX (params de template). */
export function formatAppointmentDisplay(isoStr) {
  if (!isoStr) return { dateStr: 'Por confirmar', timeStr: '' }
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return { dateStr: 'Por confirmar', timeStr: '' }
  const dateStr = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
  const timeStr = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  return { dateStr, timeStr }
}

async function callTappt(path, payload) {
  return axios.post(`${TAPPT_API_URL}${path}`, payload, {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TAPPT_API_KEY}`,
      'X-Source': 'hrm-nkuvo',
    },
  })
}

/**
 * Equivalente a notifyFollowupCreated(followup, client) del CRM.
 * Confirmación inmediata: SIEMPRE pide plantilla Meta (appointment_confirmation /
 * TAPPT_TEMPLATE_PRO en Tappt) para que llegue a usuarios nuevos sin ventana 24h.
 *
 * @param {object} appointment — { id, descripcion, fecha_cita }
 * @param {object} candidate — { id, razon_social, nombre_contacto, telefono }
 * @param {{ supabase?: object }} [opts]
 */
export function notifyAppointmentCreated(appointment, candidate, opts = {}) {
  if (!tapptEnabled()) {
    console.error(
      'Tappt notify error (appointment.created): TAPPT_API_URL / TAPPT_API_KEY no configurados'
    )
    return
  }

  const notifyTo = normalizeMexicoPhone(candidate?.telefono)
  if (!notifyTo) {
    console.error(
      'Tappt notify error (appointment.created): teléfono de candidato inválido o vacío',
      { telefono: candidate?.telefono ?? null, appointmentId: appointment?.id }
    )
    return
  }

  // Siempre template en el primer mensaje de confirmación (usuarios nuevos / sin 24h)
  const useTemplate = true
  const templateName = process.env.HRM_WA_TEMPLATE || 'appointment_confirmation'
  const { dateStr, timeStr } = formatAppointmentDisplay(appointment.fecha_cita)
  const clientName = candidate?.nombre_contacto || 'Candidato'
  const title = (appointment.descripcion || 'Cita con reclutador').slice(0, 60)

  const payload = {
    event: 'followup.created',
    followup_id: appointment.id,
    descripcion: appointment.descripcion,
    fecha_recordatorio: appointment.fecha_cita,
    notify_to: notifyTo,
    cliente: {
      id: candidate?.id || null,
      razon_social: candidate?.razon_social || 'HRM NKUVO',
      nombre_contacto: clientName,
      telefono: candidate?.telefono || null,
    },
    use_template: true,
    message_mode: 'template',
    template_name: templateName,
    template_params: {
      client_name: clientName,
      business_name: 'HRM NKUVO',
      title,
      date: dateStr,
      time: timeStr || 'Por confirmar',
    },
  }

  console.log('Tappt notify (appointment.created):', {
    appointmentId: appointment.id,
    notify_to: notifyTo,
    use_template: true,
    template_name: templateName,
    message_mode: 'template',
  })

  callTappt('/api/integrations/crm/followups', payload)
    .then(async () => {
      console.log(
        'Tappt notify ok (appointment.created):',
        appointment.id,
        '→',
        notifyTo,
        `[template:${templateName}]`
      )
      if (opts.supabase && candidate?.id) {
        try {
          await opts.supabase.auth.admin.updateUserById(candidate.id, {
            user_metadata: {
              last_tappt_wa_at: new Date().toISOString(),
            },
          })
        } catch (e) {
          console.warn('Tappt: no se pudo guardar last_tappt_wa_at', e.message)
        }
      }
    })
    .catch(err =>
      console.error(
        'Tappt notify error (appointment.created):',
        err.response?.data || err.message
      )
    )
}

/**
 * Equivalente a notifyFollowupCancelled del CRM.
 */
export function notifyAppointmentCancelled(appointmentId) {
  if (!tapptEnabled()) return

  callTappt('/api/integrations/crm/followups', {
    event: 'followup.cancelled',
    followup_id: appointmentId,
  }).catch(err =>
    console.error(
      'Tappt notify error (appointment.cancelled):',
      err.response?.data || err.message
    )
  )
}
