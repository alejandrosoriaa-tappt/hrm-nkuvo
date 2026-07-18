/**
 * Billing — integración con Clip (clip.mx)
 *
 * 18 jul 2026: reemplazado el modelo anterior (Pro $299/mes recurrente +
 * pack CV IA $149 suelto) por un solo plan de pago único: $99 MXN dan
 * acceso a TODO (directorio completo, ATS Checker con IA 5x/mes, LinkedIn
 * Score con IA) durante 30 días. Al vencer, el usuario paga de nuevo si
 * quiere seguir — no hay cobro recurrente automático, así que no existe
 * "cancelar": simplemente no se renueva.
 *
 * Arquitectura elegida tras investigar la API:
 *   - La API de suscripciones de Clip NO está documentada públicamente.
 *   - El checkout se maneja con un link hospedado que Clip genera desde el
 *     dashboard (un solo link reutilizable, de pago único — no de suscripción).
 *   - Los eventos de pago llegan por Postback Webhooks configurados en el dashboard.
 *
 * Endpoints:
 *   POST /api/hrm/billing/checkout-bundle → devuelve la URL del checkout de Clip
 *   POST /api/hrm/billing/webhook         → recibe postback de Clip (público, sin auth de usuario)
 *   GET  /api/hrm/billing/status          → estado actual del plan del usuario
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth.js'
import { isProUser, checkUsageLimit, AI_USAGE_MONTHLY_LIMIT } from '../lib/subscription.js'
import { grantBundleAccess } from '../lib/bundleAccess.js'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Link de pago único de Clip para el plan $99 MXN / 30 días.
// Crear en el dashboard de Clip como checkout de un solo cobro (no suscripción).
const CLIP_BUNDLE_LINK = process.env.CLIP_BUNDLE_LINK
const BUNDLE_PRICE = 99
const BUNDLE_DAYS = 30

// Secret para verificar que el postback viene de Clip.
// Clip no firma webhooks con HMAC, así que usamos un token secreto en la URL
// que solo nosotros conocemos: POST /api/hrm/billing/webhook?secret=<CLIP_WEBHOOK_SECRET>
const CLIP_WEBHOOK_SECRET = process.env.CLIP_WEBHOOK_SECRET

// ── GET /status ───────────────────────────────────────────────────────────
router.get('/status', authMiddleware, async (req, res) => {
  // Cuentas demo (DEMO_EMAILS en Railway): plan completo sin pasar por Clip.
  const isDemoPro = await isProUser(supabase, req.user.id, req.user.email)
  if (isDemoPro) {
    return res.json({
      status: 'active', plan: 'demo', isActive: true, isFree: false, hasCvPack: true,
      atsUsage: { used: 0, limit: AI_USAGE_MONTHLY_LIMIT },
      linkedinUsage: { used: 0, limit: AI_USAGE_MONTHLY_LIMIT },
    })
  }

  const { data, error } = await supabase
    .from('hrm_subscriptions')
    .select('status, plan, current_period_start, current_period_end, clip_customer_email, cv_pack_purchased_at')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })

  const sub = data || { status: 'free' }

  // Considerar expirado si current_period_end ya pasó (pago único, sin webhook de renovación)
  const isExpired =
    sub.status === 'active' &&
    sub.current_period_end &&
    new Date(sub.current_period_end) < new Date()

  const isActive = sub.status === 'active' && !isExpired

  const [atsUsage, linkedinUsage] = isActive
    ? await Promise.all([
        checkUsageLimit(supabase, { userId: req.user.id, email: req.user.email, kind: 'ats_rewrite' }),
        checkUsageLimit(supabase, { userId: req.user.id, email: req.user.email, kind: 'linkedin_ai' }),
      ])
    : [{ used: 0, limit: AI_USAGE_MONTHLY_LIMIT }, { used: 0, limit: AI_USAGE_MONTHLY_LIMIT }]

  res.json({
    ...sub,
    hasCvPack: Boolean(sub.cv_pack_purchased_at) || isActive,
    isActive,
    isFree: sub.status === 'free' || isExpired,
    atsUsage,
    linkedinUsage,
  })
})

// ── POST /checkout-bundle ─────────────────────────────────────────────────
// Devuelve la URL del checkout de Clip para el plan único $99/30 días.
// Clip maneja la captura de tarjeta. No guardamos ningún dato de tarjeta —
// solo referencias de Clip que llegan por webhook después del pago.
router.post('/checkout-bundle', authMiddleware, async (req, res) => {
  if (!CLIP_BUNDLE_LINK) {
    return res.status(503).json({ error: 'Plan no configurado todavía.' })
  }

  const url = new URL(CLIP_BUNDLE_LINK)
  url.searchParams.set('reference', `${req.user.id}::bundle`)

  res.json({
    checkoutUrl: url.toString(),
    plan: 'bundle_30d',
    amount: BUNDLE_PRICE,
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
  const reference    = payload.reference      // user_id::bundle que pasamos en /checkout-bundle
  const status       = payload.status         // PAID, COMPLETED, FAILED, CANCELLED...
  const paymentId    = payload.payment_id || payload.id || payload.payment_request_id
  const email        = payload.email || payload.customer_email

  // 2a. Compra suelta ($99, pago único, comprador SIN contraseña) creada vía
  // la API de checkout (POST /v2/checkout en directory.js). Confirmado con
  // pruebas reales (Railway logs) que Clip manda DOS webhooks distintos por
  // cada pago de este tipo:
  //   1. { event_type: 'REQUEST_COMPLETED', id: '<payment_request_id>', ... }
  //      — el `id` de este SÍ coincide con el payment_request_id que
  //      directory.js guardó en clip_order_id al crear el checkout, pero no
  //      trae campo `status` (por eso hay que revisar `event_type` también).
  //   2. { status: 'PAID', id: '<transaction_id>', ... } — trae `status`
  //      pero su `id` es el de la transacción, NO el del payment request,
  //      así que nunca va a hacer match — es inofensivo, solo no encuentra
  //      fila y sigue de largo (el primer webhook ya marcó todo).
  // Se revisa ANTES del early-return de "sin reference" de abajo, que es
  // solo para el flujo de link hospedado del plan ($99/30 días).
  const clipPaymentRequestId = payload.id || payload.payment_request_id || payload.order_id
  if (clipPaymentRequestId) {
    const upperStatus = (status || payload.payment_status || payload.resource_status || payload.event_type || '').toUpperCase()
    const paidStatuses = ['PAID', 'COMPLETED', 'APPROVED', 'ACTIVE', 'CHECKOUT_COMPLETED', 'REQUEST_COMPLETED']

    if (paidStatuses.includes(upperStatus)) {
      try {
        // Flip idempotente ANTES de provisionar la cuenta: si Clip reintenta
        // el webhook, la segunda vez no matchea (ya no está en 'pending') y
        // no se vuelve a llamar a grantBundleAccess ni a extender el plan.
        const { data: matched, error } = await supabase
          .from('hrm_directory_purchases')
          .update({ status: 'paid' })
          .eq('clip_order_id', clipPaymentRequestId)
          .eq('status', 'pending')
          .select('id, email')

        if (error) {
          console.error('Clip webhook (directory) DB error:', error)
          return res.status(500).json({ error: 'DB error' })
        }
        if (matched && matched.length > 0) {
          const purchase = matched[0]
          try {
            const { userId, tokenHash, tokenType } = await grantBundleAccess(supabase, {
              email: purchase.email,
              paymentId: clipPaymentRequestId,
            })
            await supabase
              .from('hrm_directory_purchases')
              .update({ user_id: userId, magic_token_hash: tokenHash, magic_token_type: tokenType })
              .eq('id', purchase.id)
          } catch (grantErr) {
            // El pago ya quedó 'paid' — no hay que cobrar de nuevo. Si falla
            // el provisioning, /lookup puede reintentar generar el acceso
            // (regenerateMagicLink) cuando el comprador vuelva con su correo.
            console.error('grantBundleAccess error (pago ya confirmado):', grantErr.message)
          }
          console.log(`Clip webhook procesado (directory): clip_order_id=${clipPaymentRequestId}`)
          return res.sendStatus(200)
        }
        // Sin match: no es esta compra (o ya estaba paid) — sigue de largo
        // al flujo del plan ($99/30 días vía link hospedado) de abajo.
      } catch (err) {
        console.error('Clip webhook (directory) error:', err)
        return res.status(500).json({ error: 'Internal error' })
      }
    }
  }

  if (!reference) {
    // Sin referencia no podemos mapear al usuario — logear y responder 200
    // (Clip reintenta si recibe non-2xx)
    console.warn('Clip webhook: sin reference, no se puede procesar', payload)
    return res.sendStatus(200)
  }

  // 2b. Plan único ($99, pago único, 30 días): reference lleva el sufijo
  // "::bundle" que pusimos en /checkout-bundle. No hay renovación automática
  // — cada pago exitoso reinicia current_period_start/end desde hoy (sin
  // acumular días si compra antes de que venza el periodo anterior, para
  // mantener el modelo simple: "un pago = 30 días desde ese pago").
  if (reference.endsWith('::bundle')) {
    const userId = reference.replace(/::bundle$/, '')
    const upperStatus = (status || '').toUpperCase()
    const paidStatuses = ['PAID', 'COMPLETED', 'APPROVED', 'ACTIVE']

    if (!paidStatuses.includes(upperStatus)) {
      console.log('Clip webhook (bundle): status no es de pago exitoso:', status)
      return res.sendStatus(200)
    }

    try {
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setDate(periodEnd.getDate() + BUNDLE_DAYS)

      const updateData = {
        user_id: userId,
        status: 'active',
        plan: 'bundle_30d',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        clip_order_id: paymentId,
        updated_at: now.toISOString(),
      }
      if (email) updateData.clip_customer_email = email

      const { error } = await supabase
        .from('hrm_subscriptions')
        .upsert(updateData, { onConflict: 'user_id' })

      if (error) {
        console.error('Clip webhook (bundle) DB error:', error)
        return res.status(500).json({ error: 'DB error' })
      }
      console.log(`Clip webhook procesado (bundle): user=${userId}`)
      return res.sendStatus(200)
    } catch (err) {
      console.error('Clip webhook (bundle) error:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  // 2c. Directorio suelto ($99, pago único, comprador sin cuenta): reference
  // lleva el sufijo "::directory" que pusimos en POST /api/hrm/directory/checkout.
  if (reference.endsWith('::directory')) {
    const orderRef = reference.replace(/::directory$/, '')
    const upperStatus = (status || '').toUpperCase()
    const paidStatuses = ['PAID', 'COMPLETED', 'APPROVED', 'ACTIVE']

    if (!paidStatuses.includes(upperStatus)) {
      console.log('Clip webhook (directory): status no es de pago exitoso:', status)
      return res.sendStatus(200)
    }

    try {
      const updateData = {
        status: 'paid',
        clip_order_id: paymentId,
        download_token: crypto.randomUUID(),
      }
      const { error } = await supabase
        .from('hrm_directory_purchases')
        .update(updateData)
        .eq('order_ref', orderRef)
        .eq('status', 'pending') // idempotente: no regenerar token si Clip reintenta el webhook

      if (error) {
        console.error('Clip webhook (directory) DB error:', error)
        return res.status(500).json({ error: 'DB error' })
      }
      console.log(`Clip webhook procesado (directory): order_ref=${orderRef}`)
      return res.sendStatus(200)
    } catch (err) {
      console.error('Clip webhook (directory) error:', err)
      return res.status(500).json({ error: 'Internal error' })
    }
  }

  // 3. Cualquier otra referencia no reconocida (ej. residual del viejo modelo
  // de suscripción mensual) — logear y responder 200 sin tocar la BD.
  console.log('Clip webhook: reference no reconocida:', reference)
  res.sendStatus(200)
})

export default router
