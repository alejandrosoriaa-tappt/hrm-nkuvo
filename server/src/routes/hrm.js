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
// email/telefono solo se incluyen si el usuario ya desbloqueó esa reclutadora
// (plan Pro o dentro de sus 5 gratis) — mismo criterio que /recruiters/:id.
// Sin este filtro, POST /contacts con cualquier recruiter_id permitiría leer
// el contacto aquí sin pasar por el conteo de desbloqueos.
router.get('/contacts', async (req, res) => {
  const userId = req.user.id

  const { data, error } = await supabase
    .from('hrm_contacts')
    .select('*, hrm_recruiters(id, nombre, industria, sitio_web, email, telefono)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  const isPro = sub?.status === 'active'

  let unlockedIds = new Set()
  if (!isPro) {
    const { data: unlocked } = await supabase
      .from('hrm_unlocked_recruiters')
      .select('recruiter_id')
      .eq('user_id', userId)
    unlockedIds = new Set((unlocked || []).map(u => u.recruiter_id))
  }

  const result = data.map(contact => {
    const recruiter = contact.hrm_recruiters
    if (!recruiter) return contact
    const canSeeContact = isPro || unlockedIds.has(recruiter.id)
    if (canSeeContact) return contact
    const { email: _, telefono: __, ...publicRecruiter } = recruiter
    return { ...contact, hrm_recruiters: publicRecruiter }
  })

  res.json(result)
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

// ATS Check — analiza el FORMATO del CV, no su contenido/relevancia.
// A propósito no pide descripción de puesto: al subir el CV el candidato
// todavía no sabe a qué vacante específica va a aplicar, así que no hay
// nada contra qué comparar keywords. Lo que sí podemos evaluar sin esa
// info es si la estructura del archivo es legible por un ATS cualquiera:
// secciones estándar, contacto detectable, tablas/columnas, longitud, etc.
//
// El score y la lista de problemas encontrados son gratis. El "cómo
// arreglarlo" (fix) de cada problema se oculta detrás del plan Pro.
router.post('/cvs/:id/ats-check', async (req, res) => {
  const userId = req.user.id

  // Obtener el CV
  const { data: cv, error: fetchErr } = await supabase
    .from('hrm_cvs')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userId)
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

  const cvTextLower = cvText.toLowerCase()
  const wordCount = (cvText.match(/\S+/g) || []).length

  // Cada check evalúa un aspecto de FORMATO (no de contenido/relevancia).
  // "fix" solo se manda al cliente si el usuario tiene plan Pro.
  const checks = []

  const sections = [
    { name: 'Experiencia', keywords: ['experiencia', 'experience', 'trabajo', 'empleo'] },
    { name: 'Educación',   keywords: ['educación', 'education', 'formación', 'universidad', 'licenciatura'] },
    { name: 'Habilidades', keywords: ['habilidades', 'skills', 'competencias', 'aptitudes'] },
  ]
  sections.forEach(s => {
    const passed = s.keywords.some(k => cvTextLower.includes(k))
    checks.push({
      name: `Sección "${s.name}"`,
      passed,
      issue: passed ? null : `No se detectó una sección de ${s.name.toLowerCase()}.`,
      fix: passed ? null : `Agrega un encabezado claro llamado "${s.name}" — los ATS buscan estos títulos estándar para clasificar tu información.`,
    })
  })

  // Contacto detectable: email y teléfono con formato reconocible
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(cvText)
  checks.push({
    name: 'Correo electrónico detectable',
    passed: hasEmail,
    issue: hasEmail ? null : 'No se encontró un correo electrónico con formato reconocible.',
    fix: hasEmail ? null : 'Escribe tu correo como texto plano (no como imagen) cerca del encabezado, ej: nombre@correo.com.',
  })

  const hasPhone = /(\+?\d[\d\s-]{8,14}\d)/.test(cvText)
  checks.push({
    name: 'Teléfono detectable',
    passed: hasPhone,
    issue: hasPhone ? null : 'No se encontró un número de teléfono con formato reconocible.',
    fix: hasPhone ? null : 'Incluye tu celular en un solo bloque de texto, ej: 442 123 4567, sin separarlo con símbolos raros.',
  })

  // Tablas/columnas múltiples — los parsers de texto de los ATS las desordenan
  const looksLikeTables = cvTextLower.includes('\t') || (cvText.match(/\s{5,}/g) || []).length > 10
  checks.push({
    name: 'Sin tablas o columnas múltiples',
    passed: !looksLikeTables,
    issue: looksLikeTables ? 'El CV parece usar tablas o columnas múltiples.' : null,
    fix: looksLikeTables ? 'Evita tablas y diseños de dos columnas — cuando un ATS los lee como texto plano, el orden de la información se rompe. Usa un diseño de una sola columna.' : null,
  })

  // Longitud razonable — muy corto (falta info) o excesivo (dificulta el parseo/lectura)
  const lengthOk = wordCount >= 150 && wordCount <= 1200
  checks.push({
    name: 'Longitud adecuada',
    passed: lengthOk,
    issue: lengthOk ? null : wordCount < 150
      ? 'El CV es muy corto — puede faltar información clave.'
      : 'El CV es muy extenso — los ATS y reclutadores priorizan CVs concisos.',
    fix: lengthOk ? null : wordCount < 150
      ? 'Agrega detalle a tu experiencia y educación — un CV de 1 página suele tener entre 300 y 600 palabras.'
      : 'Recorta a lo más relevante de los últimos 10 años. Apunta a 1-2 páginas (aprox. 400-800 palabras).',
  })

  // Fechas en experiencia — sin años, un ATS no puede armar tu cronología
  const hasDates = /\b(19|20)\d{2}\b/.test(cvText)
  checks.push({
    name: 'Fechas de experiencia',
    passed: hasDates,
    issue: hasDates ? null : 'No se detectaron años en tu historial de experiencia.',
    fix: hasDates ? null : 'Incluye mes y año de inicio/fin en cada puesto (ej: "Ene 2022 – Presente") para que el ATS arme tu línea de tiempo.',
  })

  const passedCount = checks.filter(c => c.passed).length
  const score = Math.round((passedCount / checks.length) * 100)

  // ¿El usuario tiene plan Pro? Solo Pro ve el "fix" de cada problema.
  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  const isPro = sub?.status === 'active'

  const results = checks.map(({ fix, ...rest }) => ({
    ...rest,
    fix: isPro ? fix : (rest.passed ? null : undefined), // undefined = "bloqueado, suscríbete"
  }))

  // Actualizar ats_score en BD
  await supabase
    .from('hrm_cvs')
    .update({ ats_score: score })
    .eq('id', cv.id)

  res.json({
    score,
    totalChecks: checks.length,
    passedChecks: passedCount,
    results,
    isPro,
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
