import axios from 'axios'

// Adaptado de backend/src/services/tappt.js. La integración original del CRM
// es de una sola vía: notifica a UN número (el de Alejandro) cuando se crea
// un follow-up. Aquí notify_to es dinámico (el teléfono del propio candidato)
// porque cada usuario del HRM necesita su propio recordatorio de cita, no un
// solo dueño de cuenta. Pendiente confirmar con el equipo Tappt si el
// endpoint /api/integrations/crm/followups acepta destinatarios arbitrarios
// o si hace falta un endpoint B2C distinto.
//
// Variables de entorno (servicio HRM en Railway):
//   TAPPT_API_URL — URL base del backend de Tappt
//   TAPPT_API_KEY — API key compartida entre HRM y Tappt

const TAPPT_API_URL = process.env.TAPPT_API_URL
const TAPPT_API_KEY = process.env.TAPPT_API_KEY

export function tapptEnabled() {
  return Boolean(TAPPT_API_URL && TAPPT_API_KEY)
}

async function callTappt(path, payload) {
  return axios.post(`${TAPPT_API_URL}${path}`, payload, {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TAPPT_API_KEY}`,
      'X-Source': 'hrm-nkuvo'
    }
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
    notify_to: userPhone
  }).catch(err => console.error('Tappt notify error (appointment.created):', err.response?.data || err.message))
}

export function notifyAppointmentCancelled(appointmentId) {
  if (!tapptEnabled()) return

  callTappt('/api/integrations/crm/followups', {
    event: 'followup.cancelled',
    followup_id: appointmentId
  }).catch(err => console.error('Tappt notify error (appointment.cancelled):', err.response?.data || err.message))
}
