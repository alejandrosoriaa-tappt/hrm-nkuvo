/**
 * Billing — integración con Clip (clip.mx)
 *
 * Arquitectura elegida tras investigar la API:
 *   - La API de suscripciones de Clip NO está documentada públicamente.
 *   - El checkout de suscripción se maneja con un link hospedado que Clip genera
 *     desde el dashboard (un solo link reutilizable para el plan).
 *   - Los eventos de pago llegan por Postback Webhooks configurados en el dashboard.
 *   - La cancelación programática no tiene endpoint documentado; el flujo es:
 *     marcar la intención en BD y guiar al usuario a Clip o al soporte de NKUVO.
 *
 * Endpoints:
 *   POST /api/hrm/billing/checkout  → devuelve la URL del checkout de Clip
 *   POST /api/hrm/billing/webhook   → recibe postback de Clip (público, sin auth de usuario)
 *   POST /api/hrm/billing/cancel    → usuario solicita cancelar
 *   GET  /api/hrm/billing/status    → estado actual de la suscripción del usuario
 */

import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth.js'
import { isProUser } from '../lib/subscription.js'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Link de suscripción de Clip (creado desde el dashboard, único para el plan HRM $299/mes)
const CLIP_SUBSCRIPTION_LINK =
  process.env.CLIP_SUBSCRIPTION_LINK ||
  'https://pago.clip.mx/v2/suscripcion/eaadea41-f533-4902-8fb3-a1836c57b83f'

// Secret para verificar que el postback viene de Clip.
// Clip no firma webhooks con HMAC, así que usamos un token secreto en la URL
// que solo nosotros conocemos: POST /api/hrm/billing/webhook?secret=<CLIP_WEBHOOK_SECRET>
const CLIP_WEBHOOK_SECRET = process.env.CLIP_WEBHOOK_SECRET

// ── GET /status ───────────────────────────────────────────────────────────
router.get('/status', authMiddleware, async (req, res) => {
  // Cuentas demo (DEMO_EMAILS en Railway): Pro sin pasar por Clip.
  const isDemoPro = await isProUser(supabase, req.user.id, req.user.email)
  if (isDemoPro) {
    return res.json({ status: 'active', plan: 'demo', isActive: true, isFree: false })
  }

  const { data, error } = await supabase
    .from('hrm_subscriptions')
    .select('status, plan, current_period_end, clip_customer_email, cancel_requested_at')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })

  const sub = data || { status: 'free' }

  // Considerar expirado si current_period_end ya pasó (aunque Clip no canceló aún)
  const isExpired =
    sub.status === 'active' &&
    sub.current_period_end &&
    new Date(sub.current_period_end) < new Date()

  res.json({
    ...sub,
    isActive: sub.status === 'active' && !isExpired,
    isFree:   sub.status === 'free' || isExpired,
  })
})

// ── POST /checkout ────────────────────────────────────────────────────────
// Devuelve la URL del checkout de Clip. El cliente redirige al usuario ahí.
// Clip maneja la captura de tarjeta y el cobro recurrente.
// No guardamos ningún dato de tarjeta — solo referencias de Clip que llegan
// por webhook después del pago.
router.post('/checkout', authMiddleware, async (req, res) => {
  // Verificar que no tenga ya suscripción activa
  const { data: existing } = await supabase
    .from('hrm_subscriptions')
    .select('status, current_period_end')
    .eq('user_id', req.user.id)
    .maybeSingle()

  if (existing?.status === 'active') {
    const isExpired = existing.current_period_end && new Date(existing.current_period_end) < new Date()
    if (!isExpired) {
      return res.status(409).json({ error: 'Ya tienes una suscripción activa.' })
    }
  }

  // El link de Clip acepta parámetros de referencia para identificar al usuario
  // cuando Clip nos notifica por webhook (reference se puede mapear a user_id).
  const url = new URL(CLIP_SUBSCRIPTION_LINK)
  url.searchParams.set('reference', req.user.id)

  res.json({
    checkoutUrl: url.toString(),
    plan: 'suscripcion_mensual',
    amount: 299,
    currency: 'MXN',
  })
})

// ── POST /webhook ─────────────────────────────────────────────────────────
// Postback de Clip. Se configura en Dashboard > Postback Webhook.
// URL a configurar: https://hrm.nkuvo.com/api/hrm/billing/webhook?secret=<CLIP_WEBHOOK_SECRET>
//
// Clip no firma los webhooks con HMAC, así que la verificación es el secret en query.
// Payload documentado de Clip (postback):
//   { payment_id, reference, status, amount, currency, email, ... }
// Los status que nos interesan: "PAID" | "COMPLETED" | "FAILED" | "CANCELLED"
//
// NOTA: dado que la documentación de Clip para suscripciones es incompleta,
// este handler está preparado para múltiples variantes de payload que Clip
// podría enviar en sus distintos tipos de webhook (postback, HXO, transparent).
router.post('/webhook', async (req, res) => {
  // 1. Verificar secret de webhook
  const incomingSecret = req.query.secret
  if (CLIP_WEBHOOK_SECRET && incomingSecret !== CLIP_WEBHOOK_SECRET) {
    console.warn('Clip webhook: secret inválido')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const payload = req.body
  console.log('Clip webhook payload:', JSON.stringify(payload))

  // 2. Extraer campos del payload (Clip puede variar la estructura)
  const reference    = payload.reference      // user_id que pasamos en /checkout
  const status       = payload.status         // PAID, COMPLETED, FAILED, CANCELLED...
  const paymentId    = payload.payment_id || payload.id
  const email        = payload.email || payload.customer_email
  const amount       = payload.amount
  // Para suscripciones recurrentes Clip puede enviar period info
  const periodEnd    = payload.next_payment_date || payload.period_end

  if (!reference) {
    // Sin referencia no podemos mapear al usuario — logear y responder 200
    // (Clip reintenta si recibe non-2xx)
    console.warn('Clip webhook: sin reference, no se puede procesar', payload)
    return res.sendStatus(200)
  }

  // 3. Determinar nuevo status
  const statusMap = {
    'PAID':       'active',
    'COMPLETED':  'active',
    'APPROVED':   'active',
    'ACTIVE':     'active',
    'FAILED':     'past_due',
    'REJECTED':   'past_due',
    'CANCELLED':  'cancelled',
    'CANCELED':   'cancelled',
    'EXPIRED':    'cancelled',
  }

  const upperStatus = (status || '').toUpperCase()
  const newStatus = statusMap[upperStatus]

  if (!newStatus) {
    // Status desconocido — logear, no actualizar BD, responder 200
    console.log('Clip webhook: status desconocido:', status)
    return res.sendStatus(200)
  }

  // 4. Calcular current_period_end (aproximar 31 días si Clip no lo manda)
  let currentPeriodEnd = periodEnd ? new Date(periodEnd).toISOString() : null
  if (newStatus === 'active' && !currentPeriodEnd) {
    const d = new Date()
    d.setDate(d.getDate() + 31)
    currentPeriodEnd = d.toISOString()
  }

  // 5. Upsert en hrm_subscriptions
  try {
    const updateData = {
      user_id: reference,
      status: newStatus,
      plan: 'suscripcion_mensual',
      clip_order_id: paymentId,
      updated_at: new Date().toISOString(),
    }
    if (email)            updateData.clip_customer_email = email
    if (currentPeriodEnd) updateData.current_period_end  = currentPeriodEnd
    if (newStatus === 'active') updateData.cancel_requested_at = null // limpiar si reactivó

    const { error } = await supabase
      .from('hrm_subscriptions')
      .upsert(updateData, { onConflict: 'user_id' })

    if (error) {
      console.error('Clip webhook DB error:', error)
      return res.status(500).json({ error: 'DB error' })
    }

    console.log(`Clip webhook procesado: user=${reference} status=${newStatus}`)
    res.sendStatus(200)
  } catch (err) {
    console.error('Clip webhook error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// ── POST /cancel ──────────────────────────────────────────────────────────
// El usuario solicita cancelar su suscripción.
// Clip no tiene endpoint documentado para cancelar programáticamente, así que:
//   1. Marcamos cancel_requested_at en BD
//   2. Devolvemos instrucciones para que el usuario cancele desde el portal de Clip
//      o contacte soporte de NKUVO Labs vía WhatsApp
// El acceso Pro se mantiene hasta current_period_end (ya pagó ese periodo).
router.post('/cancel', authMiddleware, async (req, res) => {
  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('status, current_period_end, cancel_requested_at')
    .eq('user_id', req.user.id)
    .maybeSingle()

  if (!sub || sub.status !== 'active') {
    return res.status(400).json({ error: 'No tienes una suscripción activa.' })
  }
  if (sub.cancel_requested_at) {
    return res.status(400).json({
      error: 'Ya solicitaste la cancelación. El equipo NKUVO la procesará pronto.',
      cancelRequestedAt: sub.cancel_requested_at,
    })
  }

  const { error } = await supabase
    .from('hrm_subscriptions')
    .update({ cancel_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', req.user.id)

  if (error) return res.status(500).json({ error: error.message })

  // TODO cuando Clip exponga endpoint de cancelación API: llamarlo aquí
  // Por ahora el soporte de NKUVO procesa la cancelación manualmente desde
  // el panel de Clip (Dashboard > Pagos Recurrentes > eliminar suscriptor).

  res.json({
    ok: true,
    message: 'Solicitud de cancelación registrada. Tu acceso Pro se mantiene hasta el fin del periodo actual.',
    currentPeriodEnd: sub.current_period_end,
    supportWhatsApp: 'https://wa.me/5215658732336',
  })
})

export default router
