/**
 * Venta del directorio de reclutadoras ($99 MXN, pago único, SIN cuenta).
 *
 * Flujo (landing pública /directorio, fuera del login):
 *   1. POST /checkout        { email } → crea compra 'pending', crea un checkout
 *      dinámico vía la API de Clip (POST /v2/checkout) y regresa su checkoutUrl.
 *   2. Clip cobra, redirige al comprador a /directorio/gracias?orderRef=...
 *      (redirection_url.success, configurable porque este checkout es de la
 *      API, a diferencia del link hospedado viejo que no soportaba redirect).
 *   3. GET  /status/:orderRef → la página de gracias hace polling hasta ver
 *      status='paid' (el webhook lo procesa billing.js, ver nota abajo).
 *   4. GET  /download/:token → genera el Excel al vuelo y lo marca como
 *      descargado (un solo uso: si ya se descargó, 410 Gone).
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
 * Router público: NO usa authMiddleware (a propósito, se monta antes de
 * /api/hrm en index.js para que el router genérico de HRM no lo capture).
 */

import { Router } from 'express'
import crypto from 'node:crypto'
import ExcelJS from 'exceljs'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'

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

const DIRECTORY_PRICE = 99

const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 10 })
const lookupLimiter = rateLimit({ windowMs: 60_000, max: 8 })

// ── POST /checkout ────────────────────────────────────────────────────────
router.post('/checkout', checkoutLimiter, async (req, res) => {
  if (!CLIP_API_KEY || !CLIP_SECRET_KEY) {
    return res.status(503).json({ error: 'Venta del directorio no configurada todavía.' })
  }

  const email = (req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Correo inválido.' })
  }

  const orderRef = crypto.randomUUID()

  const { error } = await supabase
    .from('hrm_directory_purchases')
    .insert({ email, order_ref: orderRef, status: 'pending', amount: DIRECTORY_PRICE })

  if (error) return res.status(500).json({ error: error.message })

  const clipToken = Buffer.from(`${CLIP_API_KEY}:${CLIP_SECRET_KEY}`).toString('base64')

  try {
    const clipRes = await fetch('https://api.payclip.com/v2/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${clipToken}` },
      body: JSON.stringify({
        amount: DIRECTORY_PRICE,
        currency: 'MXN',
        purchase_description: 'Directorio de reclutadoras — HRM NKUVO',
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
      amount: DIRECTORY_PRICE,
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
// La página de gracias hace polling aquí tras volver de Clip.
router.get('/status/:orderRef', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_directory_purchases')
    .select('status, download_token, downloaded_at')
    .eq('order_ref', req.params.orderRef)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Pedido no encontrado.' })

  res.json({
    status: data.status,
    downloadToken: data.status === 'paid' && !data.downloaded_at ? data.download_token : null,
    alreadyDownloaded: Boolean(data.downloaded_at),
  })
})

// ── GET /lookup ───────────────────────────────────────────────────────────
// Respaldo para cuando Clip no regresa al usuario a /directorio/gracias
// (sus links de pago hospedados no soportan redirect configurable). El
// comprador vuelve manualmente y recupera su descarga con el correo que usó.
router.get('/lookup', lookupLimiter, async (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Correo inválido.' })
  }

  const { data, error } = await supabase
    .from('hrm_directory_purchases')
    .select('download_token, downloaded_at')
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

  res.json({
    downloadToken: data.downloaded_at ? null : data.download_token,
    alreadyDownloaded: Boolean(data.downloaded_at),
  })
})

// ── GET /download/:token ──────────────────────────────────────────────────
// Genera el Excel al vuelo desde hrm_recruiters, con marca de agua del
// comprador, y marca la compra como descargada (un solo uso).
router.get('/download/:token', async (req, res) => {
  const { data: purchase, error: purchaseError } = await supabase
    .from('hrm_directory_purchases')
    .select('*')
    .eq('download_token', req.params.token)
    .maybeSingle()

  if (purchaseError) return res.status(500).json({ error: purchaseError.message })
  if (!purchase || purchase.status !== 'paid') {
    return res.status(404).json({ error: 'Link de descarga inválido.' })
  }
  if (purchase.downloaded_at) {
    return res.status(410).json({
      error: 'Este link ya fue usado. Cada compra incluye una sola descarga — escríbenos por WhatsApp si tuviste un problema.',
      supportWhatsApp: 'https://wa.me/5215658732336',
    })
  }

  // Marcar como descargado ANTES de generar el archivo (update condicionado a
  // downloaded_at IS NULL) para que dos requests concurrentes con el mismo
  // token no puedan generar el archivo dos veces.
  const { data: claimed, error: claimError } = await supabase
    .from('hrm_directory_purchases')
    .update({ downloaded_at: new Date().toISOString() })
    .eq('id', purchase.id)
    .is('downloaded_at', null)
    .select('id')

  if (claimError) return res.status(500).json({ error: claimError.message })
  if (!claimed || claimed.length === 0) {
    return res.status(410).json({
      error: 'Este link ya fue usado. Cada compra incluye una sola descarga — escríbenos por WhatsApp si tuviste un problema.',
      supportWhatsApp: 'https://wa.me/5215658732336',
    })
  }

  const { data: recruitersRaw, error: recruitersError } = await supabase
    .from('hrm_recruiters')
    .select('nombre, industria, sitio_web, email, telefono, ciudad')
    .order('nombre', { ascending: true })

  if (recruitersError) return res.status(500).json({ error: recruitersError.message })

  // Orden por completitud de datos (pedido explícito): primero las que
  // tienen sitio web + teléfono + correo, luego las que solo tienen sitio
  // web (sin teléfono y/o correo), al final el resto (solo teléfono, sin
  // sitio web). Dentro de cada grupo se mantiene el orden alfabético.
  const hasVal = (v) => Boolean(v && String(v).trim())
  const tierOf = (r) => {
    const hasWeb = hasVal(r.sitio_web)
    const hasPhone = hasVal(r.telefono)
    const hasEmail = hasVal(r.email)
    if (hasWeb && hasPhone && hasEmail) return 0
    if (hasWeb) return 1
    return 2
  }
  const recruiters = [...(recruitersRaw || [])].sort((a, b) => tierOf(a) - tierOf(b))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HRM NKUVO'
  const ws = wb.addWorksheet('Directorio de Reclutadoras')

  // Sin logo/imagen embebida a propósito — todo el look de marca (banda
  // verde, tipografía) se logra con formato de celdas, así el archivo pesa
  // menos y el texto se mantiene seleccionable/buscable.
  ws.columns = [
    { key: 'id',        width: 6 },
    { key: 'nombre',    width: 32 },
    { key: 'sitio_web', width: 30 },
    { key: 'telefono',  width: 20 },
    { key: 'email',     width: 30 },
    { key: 'ciudad',    width: 26 },
    { key: 'industria', width: 34 },
  ]

  // Fila 1 — banner de título (verde oscuro, combinada A1:G1)
  ws.mergeCells('A1:G1')
  ws.getRow(1).height = 28
  const titleCell = ws.getCell('A1')
  titleCell.value = 'Directorio de reclutadoras y agencias verificadas en México'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 2 — banner de subtítulo (verde, combinada A2:G2)
  ws.mergeCells('A2:G2')
  ws.getRow(2).height = 18
  const fechaLegible = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  const subtitleCell = ws.getCell('A2')
  subtitleCell.value = `Actualizado: ${fechaLegible}  ·  Total de registros: ${(recruiters || []).length}`
  subtitleCell.font = { size: 10, color: { argb: 'FFFFFFFF' } }
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

  // Fila 3 — encabezados de columna
  const headerRow = ws.getRow(3)
  headerRow.values = ['ID', 'Reclutadora', 'Sitio web', 'Teléfono', 'Correo', 'Ciudad', 'Industria']
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }
    cell.alignment = { vertical: 'middle' }
  })
  ws.views = [{ state: 'frozen', ySplit: 3 }]

  ;(recruiters || []).forEach((r, i) => {
    const row = ws.addRow({
      id:        i + 1,
      nombre:    r.nombre    || '',
      sitio_web: r.sitio_web ? { text: r.sitio_web, hyperlink: r.sitio_web } : '',
      telefono:  r.telefono  || '',
      email:     r.email     || '',
      ciudad:    r.ciudad    || '',
      industria: r.industria || '',
    })
    if (i % 2 === 1) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3EC' } }
      })
    }
    row.getCell('sitio_web').font = { color: { argb: 'FF16A34A' }, underline: true }
  })

  // Marca de agua de trazabilidad — no evita compartirlo, pero identifica
  // de qué compra salió si aparece circulando.
  const wmSheet = wb.addWorksheet('Info de compra')
  wmSheet.columns = [{ key: 'k', width: 22 }, { key: 'v', width: 50 }]
  wmSheet.addRow({ k: 'Comprado por', v: purchase.email })
  wmSheet.addRow({ k: 'Pedido', v: purchase.order_ref })
  wmSheet.addRow({ k: 'Fecha de descarga', v: new Date().toLocaleString('es-MX') })
  wmSheet.addRow({ k: '', v: 'Este archivo es para uso personal del comprador. Directorio HRM NKUVO — hrm.nkuvo.com' })

  const fecha = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="directorio-reclutadoras-hrm-${fecha}.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

export default router
