import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import multer from 'multer'
import nodemailer from 'nodemailer'
import ExcelJS from 'exceljs'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../middleware/auth.js'
import { sessionMiddleware } from '../middleware/session.js'

const router = Router()
router.use(authMiddleware)
router.use(sessionMiddleware)

// Cliente con service_role: el backend aplica filtros por user_id manualmente
// (mismo patrón de tenant_id que en crm.js del NKUVO CRM).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Multer: memoria (no disco), 5 MB máx, solo PDF/DOCX
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      .includes(file.mimetype)
    cb(ok ? null : new Error('Solo PDF o DOCX'), ok)
  }
})

// Rate limit extra para el endpoint de detalle de reclutadora (anti-scraping
// incluso en cuentas de pago: 30 req/hora por usuario, evaluado POR USUARIO
// en la capa de negocio, no solo por IP).
const recruiterDetailLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hora
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Demasiadas solicitudes. Espera unos minutos.' }
})

// ── Directorio de reclutadoras ────────────────────────────────────────────
// La lista NUNCA devuelve email/teléfono — anti-copia.
router.get('/recruiters', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_recruiters')
    .select('id, nombre, industria, sitio_web, ciudad')
    .order('nombre')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Detalle: devuelve email/teléfono solo si el usuario tiene plan activo
// o si todavía no superó el límite de 5 gratuitas.
// Registra el desbloqueo en hrm_unlocked_recruiters.
router.get('/recruiters/:id', recruiterDetailLimit, async (req, res) => {
  const userId = req.user.id
  const recruiterId = req.params.id

  // 1. Datos de la reclutadora
  const { data: recruiter, error } = await supabase
    .from('hrm_recruiters')
    .select('*')
    .eq('id', recruiterId)
    .single()
  if (error || !recruiter) return res.status(404).json({ error: 'No encontrada' })

  // 2. Suscripción del usuario
  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  const isPro = sub?.status === 'active'

  // 3. ¿Ya la desbloqueó antes?
  const { data: existing } = await supabase
    .from('hrm_unlocked_recruiters')
    .select('recruiter_id')
    .eq('user_id', userId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle()

  let canSeeContact = isPro || !!existing

  if (!canSeeContact) {
    // Contar cuántas ha desbloqueado antes
    const { count } = await supabase
      .from('hrm_unlocked_recruiters')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if ((count || 0) < 5) {
      // Registrar este desbloqueo (primera vez)
      await supabase
        .from('hrm_unlocked_recruiters')
        .insert({ user_id: userId, recruiter_id: recruiterId })
      canSeeContact = true
    }
  }

  if (!canSeeContact) {
    // Ocultar datos de contacto — devolver el resto
    const { email: _, telefono: __, ...publicData } = recruiter
    return res.json({ ...publicData, _contactLocked: true })
  }

  res.json(recruiter)
})

// ── Seguimiento de contacto ──────────────────────────────────────────────
router.get('/contacts', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_contacts')
    .select('*, hrm_recruiters(nombre, industria, sitio_web)')
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
  // Forzar updated_at
  const { data, error } = await supabase
    .from('hrm_contacts')
    .update({ ...req.body, updated_at: new Date().toISOString() })
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

// Export Excel — solo los contactos del usuario (nunca el directorio completo)
router.get('/contacts/export', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_contacts')
    .select('*, hrm_recruiters(nombre, industria, sitio_web, ciudad)')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HRM NKUVO'
  const ws = wb.addWorksheet('Mis Contactos')

  ws.columns = [
    { header: 'Reclutadora',    key: 'nombre',         width: 30 },
    { header: 'Industria',      key: 'industria',      width: 20 },
    { header: 'Ciudad',         key: 'ciudad',         width: 16 },
    { header: 'Sitio web',      key: 'sitio_web',      width: 30 },
    { header: 'Estado',         key: 'status',         width: 16 },
    { header: 'Notas',          key: 'notas',          width: 40 },
    { header: 'Fecha contacto', key: 'fecha_contacto', width: 20 },
    { header: 'Última actualización', key: 'updated_at', width: 22 },
  ]

  // Cabecera con color verde de marca
  ws.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  })

  ;(data || []).forEach(c => {
    ws.addRow({
      nombre:         c.hrm_recruiters?.nombre    || '',
      industria:      c.hrm_recruiters?.industria || '',
      ciudad:         c.hrm_recruiters?.ciudad    || '',
      sitio_web:      c.hrm_recruiters?.sitio_web || '',
      status:         c.status,
      notas:          c.notas || '',
      fecha_contacto: c.fecha_contacto ? new Date(c.fecha_contacto).toLocaleString('es-MX') : '',
      updated_at:     c.updated_at     ? new Date(c.updated_at).toLocaleString('es-MX')     : '',
    })
  })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="mis-contactos-hrm.xlsx"`)
  await wb.xlsx.write(res)
  res.end()
})

// ── CVs (Supabase Storage, hasta 5 variantes) ────────────────────────────
router.get('/cvs', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_cvs')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/cvs', upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

  // Verificar límite de 5 CVs por usuario
  const { count, error: countErr } = await supabase
    .from('hrm_cvs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
  if (countErr) return res.status(500).json({ error: countErr.message })
  if ((count || 0) >= 5) {
    return res.status(400).json({ error: 'Límite de 5 CVs alcanzado. Elimina uno antes de subir otro.' })
  }

  const ext = req.file.originalname.split('.').pop().toLowerCase()
  const storagePath = `${req.user.id}/${Date.now()}.${ext}`

  // Subir a Supabase Storage (bucket 'cvs')
  const { error: uploadErr } = await supabase.storage
    .from('cvs')
    .upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    })
  if (uploadErr) return res.status(500).json({ error: uploadErr.message })

  // Guardar registro en BD
  const nombre = req.body.nombre || req.file.originalname.replace(/\.[^.]+$/, '')
  const { data, error: dbErr } = await supabase
    .from('hrm_cvs')
    .insert({ user_id: req.user.id, nombre, storage_path: storagePath })
    .select()
    .single()
  if (dbErr) {
    // Limpiar Storage si falla el insert
    await supabase.storage.from('cvs').remove([storagePath])
    return res.status(500).json({ error: dbErr.message })
  }

  res.status(201).json(data)
})

router.delete('/cvs/:id', async (req, res) => {
  // Obtener storage_path antes de borrar
  const { data: cv, error: fetchErr } = await supabase
    .from('hrm_cvs')
    .select('storage_path')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()
  if (fetchErr || !cv) return res.status(404).json({ error: 'CV no encontrado' })

  // Borrar de Storage
  const { error: storageErr } = await supabase.storage
    .from('cvs')
    .remove([cv.storage_path])
  if (storageErr) console.warn('Storage delete warning:', storageErr.message)

  // Borrar de BD
  const { error: dbErr } = await supabase
    .from('hrm_cvs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
  if (dbErr) return res.status(500).json({ error: dbErr.message })

  res.status(204).end()
})

// ATS Check — parsea el CV y compara keywords contra la descripción del puesto.
// Estrategia simple pero efectiva:
//   1. Descarga el archivo de Storage
//   2. Extrae texto (pdf-parse para PDF, mammoth para DOCX)
//   3. Extrae keywords de la descripción del puesto (tokenización simple)
//   4. Calcula % de coincidencia
//   5. Sugiere secciones estándar faltantes
router.post('/cvs/:id/ats-check', async (req, res) => {
  const { jobDescription } = req.body
  if (!jobDescription?.trim()) {
    return res.status(400).json({ error: 'Falta jobDescription' })
  }

  // Obtener el CV
  const { data: cv, error: fetchErr } = await supabase
    .from('hrm_cvs')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()
  if (fetchErr || !cv) return res.status(404).json({ error: 'CV no encontrado' })

  // Descargar de Storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('cvs')
    .download(cv.storage_path)
  if (dlErr) return res.status(500).json({ error: 'No se pudo descargar el CV' })

  // Extraer texto del archivo
  let cvText = ''
  try {
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const ext = cv.storage_path.split('.').pop().toLowerCase()

    if (ext === 'pdf') {
      // pdf-parse importado dinámicamente para evitar el warning del constructor
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
      const result = await pdfParse(buffer)
      cvText = result.text
    } else if (ext === 'docx') {
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.extractRawText({ buffer })
      cvText = result.value
    } else {
      return res.status(400).json({ error: 'Formato de archivo no soportado para ATS check' })
    }
  } catch (err) {
    console.error('ATS text extraction error:', err)
    return res.status(500).json({ error: 'Error extrayendo texto del CV' })
  }

  // Extraer keywords de la descripción del puesto
  const stopwords = new Set([
    'de','la','el','en','y','a','los','las','con','se','su','un','una','para',
    'por','al','del','que','es','son','lo','le','o','e','como','no','si','ya',
    'pero','más','te','me','mi','tu','we','the','a','an','and','or','of','to',
    'in','is','for','with','that','this','are','be','on','at','by','from','as'
  ])

  const tokenize = (text) =>
    text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w))

  const jobKeywords = [...new Set(tokenize(jobDescription))]
  const cvWords = new Set(tokenize(cvText))

  const matchedKeywords = jobKeywords.filter(k => cvWords.has(k))
  const missingKeywords = jobKeywords.filter(k => !cvWords.has(k)).slice(0, 20)

  const score = jobKeywords.length > 0
    ? Math.round((matchedKeywords.length / jobKeywords.length) * 100)
    : 0

  // Detectar secciones estándar faltantes en el CV
  const cvTextLower = cvText.toLowerCase()
  const sections = [
    { name: 'experiencia',  keywords: ['experiencia', 'experience', 'trabajo', 'empleo'] },
    { name: 'educación',    keywords: ['educación', 'education', 'formación', 'universidad', 'licenciatura'] },
    { name: 'habilidades',  keywords: ['habilidades', 'skills', 'competencias', 'aptitudes'] },
    { name: 'contacto',     keywords: ['email', 'teléfono', 'linkedin', 'correo'] },
    { name: 'logros',       keywords: ['logros', 'achievements', 'resultados', 'impacto'] },
  ]

  const suggestions = []
  sections.forEach(s => {
    if (!s.keywords.some(k => cvTextLower.includes(k))) {
      suggestions.push(`Agrega una sección de "${s.name}" a tu CV`)
    }
  })

  // Advertencia sobre tablas/columnas (problemáticas para ATS)
  if (cvTextLower.includes('\t') || (cvText.match(/\s{5,}/g) || []).length > 10) {
    suggestions.push('Evita tablas o columnas múltiples — los ATS tienen dificultades para leerlas')
  }

  // Actualizar ats_score en BD
  await supabase
    .from('hrm_cvs')
    .update({ ats_score: score })
    .eq('id', cv.id)

  res.json({
    score,
    totalKeywords: jobKeywords.length,
    matchedKeywords: matchedKeywords.slice(0, 30),
    missingKeywords,
    suggestions,
  })
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
// Descarga el CV de Storage y lo adjunta al correo vía nodemailer.
// Requiere SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS en Railway.
router.post('/emails/send-cv', async (req, res) => {
  const { to, subject, cvId, message } = req.body
  if (!to || !subject || !cvId || !message) {
    return res.status(400).json({ error: 'Faltan campos: to, subject, cvId, message' })
  }

  // Obtener CV
  const { data: cv, error: cvErr } = await supabase
    .from('hrm_cvs')
    .select('*')
    .eq('id', cvId)
    .eq('user_id', req.user.id)
    .single()
  if (cvErr || !cv) return res.status(404).json({ error: 'CV no encontrado' })

  // Descargar de Storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('cvs')
    .download(cv.storage_path)
  if (dlErr) return res.status(500).json({ error: 'Error descargando el CV' })

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const ext = cv.storage_path.split('.').pop()

  // Crear transporte SMTP
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }
  })

  try {
    await transporter.sendMail({
      from: `"HRM NKUVO" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="font-size:12px;color:#666">
          Enviado desde <a href="https://hrm.nkuvo.com">HRM NKUVO</a>
        </p>`,
      attachments: [{
        filename: `${cv.nombre}.${ext}`,
        content: buffer,
        contentType: ext === 'pdf' ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }]
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('SMTP error:', err)
    res.status(500).json({ error: 'Error enviando el correo. Revisa la config SMTP.' })
  }
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
