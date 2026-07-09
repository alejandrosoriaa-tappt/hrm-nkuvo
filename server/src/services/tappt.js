import axios from 'axios'

// Conector HRM → Tappt (recordatorios de citas por WhatsApp).
// Mismo endpoint que el CRM NKUVO; aquí notify_to es el teléfono del candidato.
//
// Variables de entorno (servicio HRM en Railway):
//   TAPPT_API_URL — URL base del backend de Tappt (ej. https://www.tappt.lat)
//   TAPPT_API_KEY — API key compartida entre HRM y Tappt

const TAPPT_API_URL = process.env.TAPPT_API_URL
const TAPPT_API_KEY = process.env.TAPPT_API_KEY

export function tapptEnabled() {
  return Boolean(TAPPT_API_URL && TAPPT_API_KEY)
}

/**
 * Normaliza un teléfono a formato WhatsApp México: 521 + 10 dígitos.
 * Acepta 10 dígitos, 52…, 521…, o con espacios/guiones.
 * @returns {string|null}
 */
export function normalizeMexicoPhone(raw) {
  if (raw == null || raw === '') return null
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)

  // 521 + 10 dígitos (13) — forma preferida para WA MX
  if (digits.length === 13 && digits.startsWith('521')) return digits
  // 52 + 10 dígitos (12) → insertar el 1 de móvil
  if (digits.length === 12 && digits.startsWith('52')) {
    return `521${digits.slice(2)}`
  }
  // 1 + 10 dígitos (sin código de país)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `52${digits}`
  }
  // 10 dígitos nacionales
  if (digits.length === 10) return `521${digits}`

  // Otros largos que ya empiezan con 52 (dejar como están si parecen MX)
  if (digits.length >= 12 && digits.startsWith('52')) return digits

  return null
}

async function callTappt(path, payload) {
  return axios.post(`${TAPPT_API_URL}${path}`, payload, {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TAPPT_API_KEY}`,
      'X-Source': 'hrm-nkuvo',
    },
  })
}

// Fire-and-forget: nunca bloquea ni rompe la respuesta del HRM si Tappt falla.
export function notifyAppointmentCreated(appointment, userPhone) {
  if (!tapptEnabled() || !userPhone) return

  callTappt('/api/integrations/crm/followups', {
    event: 'followup.created',
    followup_id: appointment.id,
    descripcion: appointment.descripcion,
    fecha_recordatorio: appointment.fecha_cita,
    notify_to: userPhone,
  }).catch(err =>
    console.error(
      'Tappt notify error (appointment.created):',
      err.response?.data || err.message
    )
  )
}

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
