/**
 * Compra del plan completo ($99 MXN, pago único, SIN formulario de
 * contraseña) — 18 jul 2026: reemplaza la venta suelta del Excel de un
 * solo uso. Ahora $99 dan acceso de 30 días a TODA la app (directorio
 * completo, ATS Checker con IA, LinkedIn Score con IA), y el comprador
 * nunca tiene que llenar un formulario de registro con contraseña.
 *
 * Flujo (landing pública /directorio, fuera del login):
 *   1. POST /checkout        { email } → crea compra 'pending', crea un checkout
 *      dinámico vía la API de Clip (POST /v2/checkout) y regresa su checkoutUrl.
 *   2. Clip cobra, redirige al comprador a /directorio/gracias?orderRef=...
 *      (redirection_url.success, configurable porque este checkout es de la
 *      API, a diferencia del link hospedado viejo que no soportaba redirect).
 *   3. El webhook (billing.js) confirma el pago y llama a grantBundleAccess
 *      (server/src/lib/bundleAccess.js): crea/reusa la cuenta de Supabase
 *      Auth para ese correo con auth.admin.generateLink y activa el plan.
 *   4. GET  /status/:orderRef → la página de gracias hace polling hasta ver
 *      status='paid', y recibe un token_hash de un solo uso.
 *   5. El frontend llama supabase.auth.verifyOtp({ token_hash, type:
 *      'magiclink' }) — eso establece la sesión real sin que el usuario
 *      haya escrito una contraseña en ningún momento.
 *
 * IMPORTANTE sobre el webhook: se probó pasar un `webhook_url` propio en el
 * body de /v2/checkout (esperando que Clip lo llamara por-transacción) y
 * Clip lo ignoró por completo — confirmado con una compra real de prueba
 * que nunca disparó ningún webhook. Clip solo tiene UN Postback Webhook por
 * cuenta (dashboard.developer.clip.mx → Postback Webhook), y ya está
 * apuntando a /api/hrm/billing/webhook. Por eso el pago de esta compra lo
 * procesa billing.js (busca `metadata.orderRef` en el payload), NO este
 * archivo. Si se necesita cambiar esa URL de cuenta en el futuro, hay que
 * actualizar billing.js, no agregar otro webhook aquí.
 *
 * La descarga del Excel ya NO vive aquí (no hay endpoint público/anónimo de
 * descarga) — es un botón dentro de la app, autenticado, ver
 * GET /api/hrm/directory/download en hrm.js.
 *
 * Router público: NO usa authMiddleware (a propósito, se monta antes de
 * /api/hrm en index.js para que el router genérico de HRM no lo capture).
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import { grantBundleAccess, regenerateMagicLink } from '../lib/bundleAccess.js'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Credenciales de la API de Clip (dashboard.developer.clip.mx → Credenciales),
// distintas del link de pago hospedado que se edita en el dashboard normal.
const CLIP_API_KEY = process.env.CLIP_API_KEY
const CLIP_SECRET_KEY = process.env.CLIP_SECRET_KEY
const APP_URL = process.env.APP_URL || 'https://hrm.nkuvo.com'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const BUNDLE_PRICE = 99

const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 10 })
const lookupLimiter = rateLimit({ windowMs: 60_000, max: 8 })

// ── POST /checkout ────────────────────────────────────────────────────────
router.post('/checkout', checkoutLimiter, async (req, res) => {
  if (!CLIP_API_KEY || !CLIP_SECRET_KEY) {
    return res.status(503).json({ error: 'Compra del plan no configurada todavía.' })
  }

  const email = (req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Correo inválido.' })
  }

  const orderRef = crypto.randomUUID()

  const { error } = await supabase
    .from('hrm_directory_purchases')
    .insert({ email, order_ref: orderRef, status: 'pending', amount: BUNDLE_PRICE })

  if (error) return res.status(500).json({ error: error.message })

  const clipToken = Buffer.from(`${CLIP_API_KEY}:${CLIP_SECRET_KEY}`).toString('base64')

  try {
    const clipRes = await fetch('https://api.payclip.com/v2/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${clipToken}` },
      body: JSON.stringify({
        amount: BUNDLE_PRICE,
        currency: 'MXN',
        purchase_description: 'Plan completo 30 días — HRM NKUVO',
        redirection_url: {
          success: `${APP_URL}/directorio/gracias?orderRef=${orderRef}`,
          error: `${APP_URL}/directorio?status=error`,
          cancel: `${APP_URL}/directorio`,
        },
        metadata: { orderRef, email },
      }),
    })

    const data = await clipRes.json()
    if (!clipRes.ok) {
      console.error('Clip checkout API error:', data)
      return res.status(502).json({ error: 'No pudimos iniciar el pago con Clip. Intenta de nuevo.' })
    }
    console.log('Clip checkout creado:', JSON.stringify(data))

    // Clip no regresa reference/metadata en el webhook de confirmación (visto
    // en pruebas reales) — el único id confiable para correlacionar es el
    // payment_request_id que la propia Clip asigna, documentado como incluido
    // tanto en esta respuesta de creación como en la notificación del webhook.
    // Se guarda aquí para que billing.js pueda buscarlo cuando llegue el pago.
    const clipPaymentRequestId = data.payment_request_id || data.id
    if (clipPaymentRequestId) {
      await supabase
        .from('hrm_directory_purchases')
        .update({ clip_order_id: clipPaymentRequestId })
        .eq('order_ref', orderRef)
    }

    res.json({
      checkoutUrl: data.payment_request_url,
      orderRef,
      amount: BUNDLE_PRICE,
      currency: 'MXN',
    })
  } catch (err) {
    console.error('Clip checkout API error:', err)
    res.status(502).json({ error: 'No pudimos iniciar el pago con Clip. Intenta de nuevo.' })
  }
})

// ── GET /count ─────────────────────────────────────────────────────────────
// Conteo público del directorio para la landing (evita hardcodear el número
// en el frontend — ver TOTAL_RECRUITERS en DirectorioLandingPage.jsx). Solo
// el número, sin datos de reclutadoras — seguro de exponer sin auth.
router.get('/count', async (req, res) => {
  const { count, error } = await supabase
    .from('hrm_recruiters')
    .select('id', { count: 'exact', head: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ count: count || 0 })
})

// ── GET /status/:orderRef ─────────────────────────────────────────────────
// La página de gracias hace polling aquí tras volver de Clip. Una vez
// 'paid', el webhook (billing.js → grantBundleAccess) ya dejó un
// magic_token_hash de un solo uso — el frontend lo usa con
// supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) para loguear
// sin pedir contraseña.
router.get('/status/:orderRef', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_directory_purchases')
    .select('status, email, magic_token_hash, magic_token_type')
    .eq('order_ref', req.params.orderRef)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Pedido no encontrado.' })

  res.json({
    status: data.status,
    email: data.email,
    tokenHash: data.status === 'paid' ? data.magic_token_hash : null,
    tokenType: data.magic_token_type || 'magiclink',
  })
})

// ── GET /lookup ───────────────────────────────────────────────────────────
// Respaldo para cuando Clip no regresa al usuario a /directorio/gracias
// (sus links de pago hospedados no soportan redirect configurable), o
// cuando el token original ya expiró (los magic links de Supabase vencen
// rápido). El comprador vuelve manualmente con su correo y se le emite un
// token fresco — su cuenta y su plan ya quedaron activos en el webhook, esto
// solo re-emite la llave para entrar sin contraseña.
router.get('/lookup', lookupLimiter, async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Correo inválido.' })
  }

  const { data, error } = await supabase
    .from('hrm_directory_purchases')
    .select('id, clip_order_id, user_id')
    .eq('email', email)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) {
    return res.status(404).json({
      error: 'No encontramos un pago confirmado con ese correo. Si acabas de pagar, espera unos segundos e intenta de nuevo.',
    })
  }

  try {
    if (!data.user_id) {
      // Caso raro: el pago se confirmó pero grantBundleAccess falló en el
      // webhook (ver comentario en billing.js) — se repara aquí, activando
      // la cuenta y el plan igual que lo hubiera hecho el webhook.
      const { userId, tokenHash, tokenType } = await grantBundleAccess(supabase, {
        email,
        paymentId: data.clip_order_id,
      })
      await supabase
        .from('hrm_directory_purchases')
        .update({ user_id: userId, magic_token_hash: tokenHash, magic_token_type: tokenType })
        .eq('id', data.id)
      return res.json({ tokenHash, tokenType })
    }

    const { tokenHash, tokenType } = await regenerateMagicLink(supabase, email)
    res.json({ tokenHash, tokenType })
  } catch (err) {
    console.error('lookup access error:', err.message)
    res.status(500).json({ error: 'No pudimos generar tu acceso. Escríbenos por WhatsApp.' })
  }
})

// (Descarga eliminada de aquí — ahora es GET /api/hrm/directory/download,
// autenticado, dentro de la app. Ver server/src/routes/hrm.js.)

export default router
