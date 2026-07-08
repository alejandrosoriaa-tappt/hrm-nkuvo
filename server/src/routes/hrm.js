import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// Cliente con service_role: el backend lee/escribe sin pasar por RLS del
// usuario, y aplica el filtro por user_id manualmente en cada query (mismo
// patrón de tenant_id que crm.js, pero aquí tenant = candidato final, no
// Alejandro). Requiere SUPABASE_SERVICE_ROLE_KEY en Railway.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// STUB — pendiente de implementar contra el esquema real (ver db/schema.sql).
// Este archivo solo deja la forma de las rutas acordadas para que el cliente
// (web/src/lib/api.js -> hrmAPI) tenga contra qué apuntar.

// ── Directorio de reclutadoras (freemium: lista completa sin contacto,
//    datos de contacto solo para las primeras 5 salvo suscripción activa) ──
router.get('/recruiters', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_recruiters')
    .select('id, nombre, industria, sitio_web, ciudad')
    .order('nombre')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/recruiters/:id', async (req, res) => {
  // TODO: verificar suscripción / contador de "desbloqueados" antes de
  // devolver email/telefono. Placeholder por ahora.
  const { data, error } = await supabase
    .from('hrm_recruiters')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'No encontrado' })
  res.json(data)
})

// ── Seguimiento de contacto ──────────────────────────────────────────────
router.get('/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_contacts')
    .select('*, hrm_recruiters(nombre, industria)')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_contacts')
    .insert({ ...req.body, user_id: req.user.id })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

router.put('/contacts/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_contacts')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.delete('/contacts/:id', async (req, res) => {
  const { error } = await supabase
    .from('hrm_contacts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
})

// ── CVs (Supabase Storage, hasta 5 variantes) ────────────────────────────
router.get('/cvs', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_cvs')
    .select('*')
    .eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/cvs', async (req, res) => {
  // TODO: multer + subir a Supabase Storage bucket 'cvs', tope de 5 por user.
  res.status(501).json({ error: 'Pendiente de implementar' })
})

router.delete('/cvs/:id', async (req, res) => {
  res.status(501).json({ error: 'Pendiente de implementar' })
})

router.post('/cvs/:id/ats-check', async (req, res) => {
  // TODO: parsear texto del CV, comparar contra keywords de jobDescription,
  // revisar estructura (secciones estándar, sin tablas/columnas).
  res.status(501).json({ error: 'Pendiente de implementar' })
})

// ── Agenda / citas ────────────────────────────────────────────────────────
router.get('/appointments', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_appointments')
    .select('*, hrm_recruiters(nombre)')
    .eq('user_id', req.user.id)
    .order('fecha_cita')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/appointments', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_appointments')
    .insert({ ...req.body, user_id: req.user.id })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  // TODO: notifyAppointmentCreated(data, req.user.phone) vía services/tappt.js
  res.status(201).json(data)
})

router.put('/appointments/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_appointments')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── Envío de correo con CV adjunto ───────────────────────────────────────
router.post('/emails/send-cv', async (req, res) => {
  res.status(501).json({ error: 'Pendiente de implementar' })
})

// ── Suscripción ───────────────────────────────────────────────────────────
router.get('/subscription', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_subscriptions')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || { status: 'free' })
})

export default router
