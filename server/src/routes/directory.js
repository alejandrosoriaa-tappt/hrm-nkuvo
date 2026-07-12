/**
 * Venta del directorio de reclutadoras ($99 MXN, pago único, SIN cuenta).
 *
 * Flujo (landing pública /directorio, fuera del login):
 *   1. POST /checkout        { email } → crea compra 'pending', regresa checkoutUrl de Clip
 *   2. Clip cobra y llama al webhook de billing.js (reference termina en "::directory")
 *   3. GET  /status/:orderRef → la página de gracias hace polling hasta ver status='paid'
 *   4. GET  /download/:token → genera el Excel al vuelo y lo marca como descargado
 *      (un solo uso: si ya se descargó, 410 Gone).
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

// Link de pago único de Clip para "Directorio de reclutadoras" ($99 MXN).
// Se crea aparte en el dashboard de Clip (checkout de pago único, no suscripción).
const CLIP_DIRECTORY_LINK = process.env.CLIP_DIRECTORY_LINK

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 10 })

// ── POST /checkout ────────────────────────────────────────────────────────
router.post('/checkout', checkoutLimiter, async (req, res) => {
  if (!CLIP_DIRECTORY_LINK) {
    return res.status(503).json({ error: 'Venta del directorio no configurada todavía.' })
  }

  const email = (req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Correo inválido.' })
  }

  const orderRef = crypto.randomUUID()

  const { error } = await supabase
    .from('hrm_directory_purchases')
    .insert({ email, order_ref: orderRef, status: 'pending', amount: 99 })

  if (error) return res.status(500).json({ error: error.message })

  const url = new URL(CLIP_DIRECTORY_LINK)
  url.searchParams.set('reference', `${orderRef}::directory`)

  res.json({
    checkoutUrl: url.toString(),
    orderRef,
    amount: 99,
    currency: 'MXN',
  })
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

  const { data: recruiters, error: recruitersError } = await supabase
    .from('hrm_recruiters')
    .select('nombre, industria, sitio_web, email, telefono, ciudad')
    .order('nombre', { ascending: true })

  if (recruitersError) return res.status(500).json({ error: recruitersError.message })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HRM NKUVO'
  const ws = wb.addWorksheet('Directorio de Reclutadoras')

  ws.columns = [
    { header: 'Reclutadora', key: 'nombre',    width: 34 },
    { header: 'Industria',   key: 'industria', width: 34 },
    { header: 'Sitio web',   key: 'sitio_web', width: 32 },
    { header: 'Correo',      key: 'email',     width: 28 },
    { header: 'Teléfono',    key: 'telefono',  width: 24 },
    { header: 'Ciudad',      key: 'ciudad',    width: 24 },
  ]

  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  })

  ;(recruiters || []).forEach(r => {
    ws.addRow({
      nombre:    r.nombre    || '',
      industria: r.industria || '',
      sitio_web: r.sitio_web || '',
      email:     r.email     || '',
      telefono:  r.telefono  || '',
      ciudad:    r.ciudad    || '',
    })
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
