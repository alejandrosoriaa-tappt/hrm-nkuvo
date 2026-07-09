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
 * @returns {string|null}
 */
export function normalizeMexicoPhone(raw) {
  if (raw == null || raw === '') return null
  let digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.length === 13 && digits.startsWith('521')) return digits
  if (digits.length === 12 && digits.startsWith('52')) {
    return `521${digits.slice(2)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `52${digits}`
  }
  if (digits.length === 10) return `521${digits}`
  if (digits.length >= 12 && digits.startsWith('52')) return digits

  return null
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return '****'
  return `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
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

/**
 * Notifica a Tappt la creación de una cita.
 * Awaitable: devuelve { ok, status?, error? } sin lanzar (salvo uso interno).
 *
 * @param {object} appointment — fila de hrm_appointments
 * @param {string} userPhone — WA normalizado (521…)
 * @param {{ fullName?: string|null }} [opts]
 */
export async function notifyAppointmentCreated(appointment, userPhone, opts = {}) {
  const traceId = `tappt-${appointment?.id || 'no-id'}-${Date.now()}`

  if (!tapptEnabled()) {
    const result = { ok: false, error: 'TAPPT_API_URL / TAPPT_API_KEY no configurados', traceId }
    console.warn('[tappt] notifyAppointmentCreated SKIP env', { traceId, result })
    return result
  }
  if (!userPhone) {
    const result = { ok: false, error: 'Teléfono de destino vacío', traceId }
    console.warn('[tappt] notifyAppointmentCreated SKIP phone', { traceId, result })
    return result
  }

  const fullName = opts.fullName || null
  const payload = {
    event: 'followup.created',
    followup_id: appointment.id,
    descripcion: appointment.descripcion || 'Cita agendada en HRM',
    fecha_recordatorio: appointment.fecha_cita,
    notify_to: userPhone,
    // Tappt arma el texto con cliente.razon_social (sigue prefijando "NKUVO CRM"
    // en su plantilla; al menos el cuerpo dice HRM NKUVO).
    cliente: {
      razon_social: 'HRM NKUVO',
      nombre_contacto: fullName,
      telefono: userPhone,
    },
  }

  const url = `${TAPPT_API_URL}/api/integrations/crm/followups`
  console.log('[tappt] notifyAppointmentCreated BEFORE axios', {
    traceId,
    url,
    notify_to_masked: maskPhone(userPhone),
    notify_to: userPhone,
    payload,
    payloadJson: JSON.stringify(payload),
  })

  try {
    const res = await callTappt('/api/integrations/crm/followups', payload)
    const result = {
      ok: true,
      status: res.status,
      data: res.data,
      traceId,
      payload,
    }
    console.log('[tappt] notifyAppointmentCreated AFTER axios OK', {
      traceId,
      status: res.status,
      data: res.data,
      resultExact: result,
      resultJson: JSON.stringify(result),
    })
    return result
  } catch (err) {
    const detail = err.response?.data || err.message
    const status = err.response?.status
    const msg =
      (typeof detail === 'object' && (detail.error || detail.message)) ||
      (typeof detail === 'string' ? detail : null) ||
      'Error al contactar Tappt'
    const result = {
      ok: false,
      status: status ?? null,
      error: String(msg),
      detail,
      traceId,
      payload,
    }
    console.error('[tappt] notifyAppointmentCreated AFTER axios ERROR', {
      traceId,
      status,
      error: detail,
      message: err.message,
      resultExact: result,
      resultJson: JSON.stringify(result),
    })
    return result
  }
}

/** Fire-and-forget cancelación (no bloquea la UI). */
export function notifyAppointmentCancelled(appointmentId) {
  if (!tapptEnabled()) return

  console.log('[tappt] notifyAppointmentCancelled → request', { followup_id: appointmentId })
  callTappt('/api/integrations/crm/followups', {
    event: 'followup.cancelled',
    followup_id: appointmentId,
  })
    .then(res =>
      console.log('[tappt] notifyAppointmentCancelled ← success', {
        followup_id: appointmentId,
        status: res.status,
      })
    )
    .catch(err =>
      console.error(
        '[tappt] notifyAppointmentCancelled ← error',
        err.response?.data || err.message
      )
    )
}
