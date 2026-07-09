import axios from 'axios'

// Conector HRM → Tappt (misma estructura que nkuvo-crm-backend/src/services/tappt.js).
//
// Cuando se crea una cita en el HRM, se notifica al backend de Tappt para que
// (1) confirme por WhatsApp que el recordatorio quedó agendado y
// (2) envíe el recordatorio por WhatsApp cuando llegue la fecha.
//
// El recordatorio SIEMPRE sale por el número de Tappt — el HRM no manda
// WhatsApp por sí mismo, solo llama a la API de Tappt.
//
// Diferencia B2C vs CRM: notify_to es el teléfono del CANDIDATO
// (user_metadata.telefono normalizado), no un TAPPT_NOTIFY_PHONE fijo.
//
// Variables de entorno (Railway HRM — mismas keys que el CRM):
//   TAPPT_API_URL — https://www.tappt.lat
//   TAPPT_API_KEY  — API key compartida con Tappt

const TAPPT_API_URL = process.env.TAPPT_API_URL
const TAPPT_API_KEY = process.env.TAPPT_API_KEY

export function tapptEnabled() {
  return Boolean(TAPPT_API_URL && TAPPT_API_KEY)
}

/**
 * Normaliza a formato WhatsApp México: 521 + 10 dígitos.
 * (CRM manda TAPPT_NOTIFY_PHONE ya en ese formato; aquí lo garantizamos.)
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

async function callTappt(path, payload) {
  // Misma firma que el CRM: URL + path, Bearer, X-Source
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
 *
 * @param {object} appointment — fila hrm_appointments (id, descripcion, fecha_cita)
 * @param {object} candidate — shape de "cliente" CRM:
 *   { id, razon_social, nombre_contacto, telefono }
 *
 * Fire-and-forget: nunca bloquea ni rompe la respuesta del HRM si Tappt falla.
 */
export function notifyAppointmentCreated(appointment, candidate) {
  if (!tapptEnabled()) {
    console.error(
      'Tappt notify error (appointment.created): TAPPT_API_URL / TAPPT_API_KEY no configurados'
    )
    return
  }

  // B2C: destino = teléfono del candidato (no TAPPT_NOTIFY_PHONE del dueño CRM)
  const notifyTo = normalizeMexicoPhone(candidate?.telefono)
  if (!notifyTo) {
    console.error(
      'Tappt notify error (appointment.created): teléfono de candidato inválido o vacío',
      { telefono: candidate?.telefono ?? null, appointmentId: appointment?.id }
    )
    return
  }

  // Payload idéntico en estructura al CRM (event, followup_id, descripcion,
  // fecha_recordatorio, notify_to, cliente{...})
  callTappt('/api/integrations/crm/followups', {
    event: 'followup.created',
    followup_id: appointment.id,
    descripcion: appointment.descripcion,
    fecha_recordatorio: appointment.fecha_cita,
    notify_to: notifyTo,
    cliente: {
      id: candidate?.id || null,
      razon_social: candidate?.razon_social || 'HRM NKUVO',
      nombre_contacto: candidate?.nombre_contacto || null,
      telefono: candidate?.telefono || null,
    },
  })
    .then(() =>
      console.log('Tappt notify ok (appointment.created):', appointment.id, '→', notifyTo)
    )
    .catch(err =>
      console.error(
        'Tappt notify error (appointment.created):',
        err.response?.data || err.message
      )
    )
}

/**
 * Equivalente a notifyFollowupCancelled del CRM.
 * Fire-and-forget.
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
