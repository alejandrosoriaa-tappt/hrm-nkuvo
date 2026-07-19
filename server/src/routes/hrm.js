import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import multer from 'multer'
import ExcelJS from 'exceljs'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from '../middleware/auth.js'
import { sessionMiddleware } from '../middleware/session.js'
import {
  isProUser,
  hasCvPackAccess,
  checkContactLimit,
  getFreeContactLimit,
  countUserUnlocks,
  assertCanCreateContact,
  checkUsageLimit,
  recordUsageEvent,
  AI_USAGE_MONTHLY_LIMIT,
  isAdminEmail,
} from '../lib/subscription.js'
import { extractCvText } from '../lib/cvText.js'
import { extractLinkedinText } from '../lib/linkedinText.js'
import { buildDirectoryWorkbook } from '../lib/directoryExcel.js'
import {
  anthropicEnabled,
  createAnthropicMessage,
  parseJsonFromModelText,
} from '../lib/anthropic.js'
import {
  notifyAppointmentCreated,
  notifyAppointmentCancelled,
  normalizeMexicoPhone,
  tapptEnabled,
} from '../services/tappt.js'

// Igual que CRM (toMexicoTimestamptz): datetime-local sin zona → America/Mexico_City (-06:00)
function toMexicoTimestamptz(s) {
  if (!s || typeof s !== 'string') return s
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return s
  const withSecs = /T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s
  return `${withSecs}-06:00`
}

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

// Multer para el PDF exportado de LinkedIn ("Más" → "Guardar en PDF") — solo PDF.
const uploadLinkedin = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf'
    cb(ok ? null : new Error('Solo PDF'), ok)
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
// La lista NUNCA devuelve email/teléfono/sitio_web — anti-copia. El sitio
// web permitiría rodear el paywall (buscar el contacto directo desde ahí
// sin gastar ninguna de las 5 gratis ni pagar Pro).
router.get('/recruiters', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_recruiters')
    .select('id, nombre, industria, ciudad')
    .order('nombre')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Detalle: devuelve email/teléfono solo si el usuario tiene plan activo
// o si todavía no superó FREE_CONTACT_LIMIT desbloqueos gratuitos.
// Registra el desbloqueo en hrm_unlocked_recruiters.
router.get('/recruiters/:id', recruiterDetailLimit, async (req, res) => {
  const userId = req.user.id
  const recruiterId = req.params.id
  const freeLimit = getFreeContactLimit()

  // 1. Datos de la reclutadora
  const { data: recruiter, error } = await supabase
    .from('hrm_recruiters')
    .select('*')
    .eq('id', recruiterId)
    .single()
  if (error || !recruiter) return res.status(404).json({ error: 'No encontrada' })

  // 2. Suscripción del usuario
  const isPro = await isProUser(supabase, userId, req.user.email)

  // 3. ¿Ya la desbloqueó antes?
  const { data: existing } = await supabase
    .from('hrm_unlocked_recruiters')
    .select('recruiter_id')
    .eq('user_id', userId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle()

  let canSeeContact = isPro || !!existing

  if (!canSeeContact) {
    // Contar desbloqueos — fail closed si no hay número
    let unlockCount
    try {
      unlockCount = await countUserUnlocks(supabase, userId)
    } catch {
      const { email: _, telefono: __, sitio_web: ___, ...publicData } = recruiter
      return res.json({ ...publicData, _contactLocked: true })
    }

    if (unlockCount < freeLimit) {
      const { error: unlockInsertErr } = await supabase
        .from('hrm_unlocked_recruiters')
        .insert({ user_id: userId, recruiter_id: recruiterId })
      // Si otro request ya insertó (PK), igual consideramos desbloqueado
      if (!unlockInsertErr || unlockInsertErr.code === '23505') {
        canSeeContact = true
      }
    }
  }

  if (!canSeeContact) {
    // Ocultar datos de contacto (incluye sitio_web — desde ahí se podría
    // encontrar el contacto directo sin gastar el desbloqueo)
    const { email: _, telefono: __, sitio_web: ___, ...publicData } = recruiter
    return res.json({ ...publicData, _contactLocked: true })
  }

  res.json(recruiter)
})

// Descarga del Excel completo dentro de la app — reemplaza el link público
// de un solo uso que existía en /directorio (eliminado 18 jul 2026). Requiere
// plan activo ($99/30 días); genera el archivo al vuelo, sin límite de veces.
router.get('/directory/download', async (req, res) => {
  const isActive = await isProUser(supabase, req.user.id, req.user.email)
  if (!isActive) {
    return res.status(403).json({
      error: 'La descarga del directorio completo es parte del plan de $99 MXN / 30 días.',
      locked: true,
    })
  }

  try {
    const wb = await buildDirectoryWorkbook(supabase, req.user.email)
    const fecha = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="directorio-reclutadoras-hrm-${fecha}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err) {
    console.error('GET /directory/download error:', err)
    res.status(500).json({ error: err.message || 'Error generando el archivo' })
  }
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

  const isPro = await isProUser(supabase, userId, req.user.email)

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

// Cupo freemium de contactos (para UI del directorio / contactos).
// Debe ir ANTES de rutas con :id si se agregan después.
router.get('/contacts/quota', async (req, res) => {
  try {
    const quota = await checkContactLimit(supabase, req.user.id, req.user.email)
    let unlockedCount = 0
    if (!quota.isPro) {
      try {
        unlockedCount = await countUserUnlocks(supabase, req.user.id)
      } catch {
        unlockedCount = 0
      }
    }
    res.json({
      ...quota,
      unlockedCount: quota.isPro ? null : unlockedCount,
      unlockLimit: quota.isPro ? null : quota.limit,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Agregar a seguimiento: ÚNICO punto de insert en hrm_contacts.
// Dual check vía assertCanCreateContact (conteo real + unlock). Pro/demo sin tope.
router.post('/contacts', async (req, res) => {
  const userId = req.user.id
  const recruiterId = req.body?.recruiter_id

  const gate = await assertCanCreateContact(supabase, {
    userId,
    email: req.user.email,
    recruiterId,
  })
  if (!gate.ok) {
    return res.status(gate.status).json(gate.body)
  }

  // Solo campos permitidos — no reenviar el body completo
  const row = {
    user_id: userId,
    recruiter_id: recruiterId,
    status: ['contactado', 'en_proceso', 'respuesta', 'descartado'].includes(req.body?.status)
      ? req.body.status
      : 'contactado',
    notas: typeof req.body?.notas === 'string' ? req.body.notas : null,
    fecha_contacto: req.body?.fecha_contacto || new Date().toISOString(),
  }

  // Re-chequeo inmediato del cupo justo antes del insert (mitiga race TOCTOU)
  if (!gate.isPro) {
    const recheck = await assertCanCreateContact(supabase, {
      userId,
      email: req.user.email,
      recruiterId,
    })
    if (!recheck.ok) {
      return res.status(recheck.status).json(recheck.body)
    }
  }

  const { data, error } = await supabase
    .from('hrm_contacts')
    .insert(row)
    .select()
    .single()

  if (error) {
    // unique (user_id, recruiter_id) — ya en seguimiento
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Este reclutador ya está en tus contactos.' })
    }
    return res.status(500).json({ error: error.message })
  }
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

// ATS Check — FORMATO del CV (no contenido/relevancia al puesto).
// Score y problemas: gratis. "fix" de cada problema: plan Pro.
// Heurísticas reutilizadas por "Sugerir con IA" (mismo criterio de compliance).
const ATS_PASSING_SCORE = 90

function analyzeAtsFormat(cvText) {
  const cvTextLower = (cvText || '').toLowerCase()
  const wordCount = (cvText.match(/\S+/g) || []).length
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

  const looksLikeTables = cvTextLower.includes('\t') || (cvText.match(/\s{5,}/g) || []).length > 10
  checks.push({
    name: 'Sin tablas o columnas múltiples',
    passed: !looksLikeTables,
    issue: looksLikeTables ? 'El CV parece usar tablas o columnas múltiples.' : null,
    fix: looksLikeTables ? 'Evita tablas y diseños de dos columnas — cuando un ATS los lee como texto plano, el orden de la información se rompe. Usa un diseño de una sola columna.' : null,
  })

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

  const hasDates = /\b(19|20)\d{2}\b/.test(cvText)
  checks.push({
    name: 'Fechas de experiencia',
    passed: hasDates,
    issue: hasDates ? null : 'No se detectaron años en tu historial de experiencia.',
    fix: hasDates ? null : 'Incluye mes y año de inicio/fin en cada puesto (ej: "Ene 2022 – Presente") para que el ATS arme tu línea de tiempo.',
  })

  const passedCount = checks.filter(c => c.passed).length
  const score = Math.round((passedCount / checks.length) * 100)
  return { checks, score, passedCount, wordCount, totalChecks: checks.length }
}

router.post('/cvs/:id/ats-check', async (req, res) => {
  const userId = req.user.id

  const { data: cv, error: fetchErr } = await supabase
    .from('hrm_cvs')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .single()
  if (fetchErr || !cv) return res.status(404).json({ error: 'CV no encontrado' })

  let cvText = ''
  try {
    cvText = await extractCvText(supabase, cv)
  } catch (err) {
    console.error('ATS text extraction error:', err)
    return res.status(500).json({ error: err.message || 'Error extrayendo texto del CV' })
  }

  const { checks, score, passedCount } = analyzeAtsFormat(cvText)
  // Pro o pack CV IA ($149 pago único) ven el "cómo arreglarlo" de cada check.
  const hasFixAccess = await hasCvPackAccess(supabase, userId, req.user.email)

  const results = checks.map(({ fix, ...rest }) => ({
    ...rest,
    fix: hasFixAccess ? fix : (rest.passed ? null : undefined), // undefined = "bloqueado, suscríbete"
  }))

  await supabase
    .from('hrm_cvs')
    .update({ ats_score: score })
    .eq('id', cv.id)

  const passesThreshold = score >= ATS_PASSING_SCORE

  res.json({
    score,
    passingScore: ATS_PASSING_SCORE,
    passesThreshold,
    verdict: passesThreshold
      ? 'Tu CV tiene el formato que un ATS espera — no lo está descartando de entrada.'
      : `Por debajo de ${ATS_PASSING_SCORE}. Los reclutadores suelen revisar solo una fracción de los CVs que reciben (a veces 10 de 100) — con este formato tu CV queda en desventaja frente a los que sí están al 100%.`,
    totalChecks: checks.length,
    passedChecks: passedCount,
    results,
    isPro: hasFixAccess,
  })
})

/** Sugerencias ATS a partir de checks fallidos (sin Anthropic). */
function buildHeuristicAtsSuggestions(analysis) {
  const failed = analysis.checks.filter(c => !c.passed)
  return {
    resumen: failed.length === 0
      ? 'Tu CV ya pasa todos los checks de formato ATS. No hay bloqueos estructurales detectados.'
      : `Score de formato ${analysis.score}%. Corrige estos puntos de estructura para acercarte al 100% de compliance ATS.`,
    score_actual: analysis.score,
    objetivo: 100,
    checklist_100: failed.length === 0
      ? analysis.checks.map(c => `✓ ${c.name}`)
      : failed.map(c => c.fix || c.issue || c.name),
    sugerencias: failed.map(c => ({
      seccion: c.name,
      prioridad: 'alta',
      problema: c.issue,
      accion: c.fix,
      ejemplo: null,
      razon: 'Necesario para que el ATS detecte y clasifique esta información en texto plano.',
    })),
    source: 'heuristic',
  }
}

// Sugerir con IA — Pro. Sugerencias de FORMATO y estructura ATS (no reescribe
// contenido narrativo). Usa Anthropic si ANTHROPIC_API_KEY está configurada;
// si no, o si Claude falla, devuelve heurísticas del ATS check (misma forma).
router.post('/cvs/:id/rewrite', async (req, res) => {
  const userId = req.user.id

  // Requiere plan activo ($99 MXN / 30 días) — o el viejo pack CV IA ($149,
  // descontinuado) para quien ya lo compró.
  const hasAccess = await hasCvPackAccess(supabase, userId, req.user.email)
  if (!hasAccess) {
    return res.status(403).json({
      error: 'Sugerencias con IA disponibles con el plan de $99 MXN / 30 días.',
      locked: true,
    })
  }

  // Límite de 5 usos por periodo de 30 días (solo aplica a quien tiene el
  // plan activo — el viejo pack de por vida no está limitado).
  const isPlanActive = await isProUser(supabase, userId, req.user.email)
  if (isPlanActive) {
    const usage = await checkUsageLimit(supabase, { userId, email: req.user.email, kind: 'ats_rewrite' })
    if (!usage.allowed) {
      return res.status(403).json({
        error: `Alcanzaste el límite de ${usage.limit} usos de "Sugerir con IA" este periodo (${usage.used}/${usage.limit}). Se reinicia cuando renueves tu plan.`,
        locked: true,
        reason: 'usage_limit',
        usage,
      })
    }
  }

  const { data: cv, error: fetchErr } = await supabase
    .from('hrm_cvs')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .single()
  if (fetchErr || !cv) return res.status(404).json({ error: 'CV no encontrado' })

  let cvText = ''
  try {
    cvText = await extractCvText(supabase, cv)
  } catch (err) {
    console.error('CV AI suggest text extraction error:', err)
    return res.status(500).json({ error: err.message || 'Error extrayendo texto del CV' })
  }

  const analysis = analyzeAtsFormat(cvText)
  const failedChecks = analysis.checks.filter(c => !c.passed)

  // 100% en heurísticas → respuesta inmediata sin gastar tokens.
  if (failedChecks.length === 0 && analysis.score >= 100) {
    const alreadyOk = buildHeuristicAtsSuggestions(analysis)
    await supabase
      .from('hrm_cvs')
      .update({
        rewrite_suggestions: alreadyOk,
        rewrite_generated_at: new Date().toISOString(),
        ats_score: analysis.score,
      })
      .eq('id', cv.id)
    return res.json(alreadyOk)
  }

  let normalized = null

  if (anthropicEnabled()) {
    const truncatedText = cvText.length > 14000
      ? `${cvText.slice(0, 14000)}\n\n[…texto truncado por longitud…]`
      : cvText

    const failedSummary = failedChecks
      .map(c => `- ${c.name}: ${c.issue}`)
      .join('\n')

    const systemPrompt = `Eres un experto en CVs y ATS (Applicant Tracking Systems) para candidatos en México.
Tu ÚNICO trabajo es proponer mejoras de FORMATO y ESTRUCTURA para que un ATS pueda parsear el CV al 100%.

PROHIBIDO:
- Reescribir el tono, narrativa o "vender mejor" la experiencia.
- Inventar puestos, empresas, fechas, logros, habilidades o datos de contacto.
- Sugerir cambiar el contenido profesional salvo cuando el check de formato lo exige (p. ej. agregar encabezado "Experiencia", poner años en fechas).

OBLIGATORIO:
- Enfócate en: encabezados de sección estándar, una sola columna (sin tablas), contacto en texto plano, fechas mes/año, longitud, orden legible al parsear a texto.
- Cada sugerencia debe ser accionable: el usuario debe saber exactamente qué editar en Word/Google Docs/PDF.
- Prioriza los fallos del ATS check que te pasamos; puedes añadir hallazgos de estructura del texto extraído.
- Responde ÚNICAMENTE con JSON válido (sin markdown ni texto fuera del JSON), con esta forma exacta:
{
  "resumen": "2-3 frases: diagnóstico de formato y qué falta para 100% ATS",
  "score_actual": <número 0-100 del análisis que te dimos>,
  "objetivo": 100,
  "checklist_100": ["paso concreto 1", "paso concreto 2", "..."],
  "sugerencias": [
    {
      "seccion": "ej. Encabezado / Contacto / Experiencia / Estructura del documento",
      "prioridad": "alta" | "media" | "baja",
      "problema": "qué falla para el ATS (formato)",
      "accion": "instrucción clara de edición",
      "ejemplo": "ejemplo corto de cómo debería verse en texto plano (sin inventar hechos del candidato)",
      "razon": "por qué el ATS lo necesita"
    }
  ]
}`

    const userPrompt = `Análisis ATS actual (heurístico del producto):
Score: ${analysis.score}% (${analysis.passedCount}/${analysis.totalChecks} checks)
Palabras detectadas en texto plano: ${analysis.wordCount}
Umbral de competitividad del producto: ${ATS_PASSING_SCORE}%

Fallos detectados:
${failedSummary || '(ninguno crítico en heurística; busca mejoras de estructura residuales)'}

Texto plano extraído del CV (así lo "ve" un ATS):
---
${truncatedText}
---`

    try {
      const { rawText } = await createAnthropicMessage({
        system: systemPrompt,
        user: userPrompt,
        max_tokens: 3000,
        temperature: 0.2,
      })
      const aiResult = parseJsonFromModelText(rawText)
      normalized = {
        resumen: aiResult.resumen || 'Revisa las sugerencias de formato para mejorar la legibilidad ATS.',
        score_actual: typeof aiResult.score_actual === 'number' ? aiResult.score_actual : analysis.score,
        objetivo: 100,
        checklist_100: Array.isArray(aiResult.checklist_100) ? aiResult.checklist_100 : [],
        sugerencias: Array.isArray(aiResult.sugerencias) ? aiResult.sugerencias : [],
        source: 'anthropic',
      }
    } catch (err) {
      console.error('CV AI suggest Anthropic error (fallback a heurísticas):', err?.message || err)
      normalized = buildHeuristicAtsSuggestions(analysis)
      normalized.resumen = `${normalized.resumen} (generado con reglas ATS: Claude no respondió correctamente).`
    }
  } else {
    // Sin ANTHROPIC_API_KEY: aún devolvemos sugerencias accionables del ATS check.
    console.warn('CV AI suggest: ANTHROPIC_API_KEY ausente — usando heurísticas ATS')
    normalized = buildHeuristicAtsSuggestions(analysis)
  }

  await supabase
    .from('hrm_cvs')
    .update({
      rewrite_suggestions: normalized,
      rewrite_generated_at: new Date().toISOString(),
      ats_score: analysis.score,
    })
    .eq('id', cv.id)

  // Solo cuenta contra el límite de 5/mes si de verdad se generó una
  // sugerencia (no el atajo de "ya está en 100%" de arriba, que no gasta nada).
  if (isPlanActive) {
    await recordUsageEvent(supabase, userId, 'ats_rewrite')
  }

  res.json(normalized)
})

// ══════════════════════════════════════════════════════════════════════════
// LinkedIn Score — completitud + buenas prácticas del perfil (gratis) y
// análisis por industria con IA (plan $99/30 días). Ver metodología pública
// en /metodologia-linkedin (web/src/pages/MetodologiaLinkedInPage.jsx).
// Un solo perfil "activo" por usuario — volver a subir/pegar lo reemplaza.
// ══════════════════════════════════════════════════════════════════════════

/**
 * Checks heurísticos de completitud, basados en el criterio público "All-Star"
 * de LinkedIn (foto, resumen, experiencia, educación, aptitudes, ubicación) +
 * estructura legible. No mide el algoritmo de ranking real de LinkedIn — eso
 * no es público (ver metodología).
 */
function analyzeLinkedinProfile(text) {
  const textLower = (text || '').toLowerCase()
  const wordCount = (text.match(/\S+/g) || []).length
  const checks = []

  checks.push({
    name: 'Sección "Acerca de" / "About"',
    passed: /acerca de|about/i.test(text) && wordCount > 80,
    issue: null,
    fix: 'Agrega o amplía tu "Acerca de": 3-5 párrafos que resuman tu trayectoria y lo que buscas.',
  })

  const hasExperience = /experiencia|experience/i.test(text)
  const yearMatches = (text.match(/\b(19|20)\d{2}\b/g) || [])
  checks.push({
    name: 'Experiencia con fechas',
    passed: hasExperience && yearMatches.length >= 2,
    issue: null,
    fix: 'Agrega al menos 2 experiencias con mes/año de inicio y fin (o "Presente").',
  })

  checks.push({
    name: 'Educación',
    passed: /educaci[oó]n|education|universidad|licenciatura/i.test(text),
    issue: null,
    fix: 'Agrega tu formación académica en la sección de Educación.',
  })

  const skillsMatches = (textLower.match(/aptitud|skill|competencia/g) || []).length
  checks.push({
    name: '5 o más aptitudes',
    passed: skillsMatches >= 3, // proxy: el PDF exportado repite "aptitud"/"skill" por cada una listada
    issue: null,
    fix: 'Agrega al menos 5 aptitudes relevantes a tu industria — LinkedIn las usa para que te encuentren en búsquedas.',
  })

  checks.push({
    name: 'Ubicación e industria configuradas',
    passed: /ubicaci[oó]n|location|m[ée]xico|industria|industry/i.test(text),
    issue: null,
    fix: 'Completa tu ubicación e industria en la configuración de tu perfil.',
  })

  checks.push({
    name: 'Titular con contenido (no solo tu puesto)',
    passed: wordCount > 150,
    issue: null,
    fix: 'Escribe un titular que diga qué haces y para quién, no solo tu puesto actual (ej. "Gerente de Ventas | B2B Industrial | CDMX").',
  })

  checks.forEach(c => { if (!c.passed) c.issue = c.issue || `No se detectó: ${c.name.toLowerCase()}.` })

  const passedCount = checks.filter(c => c.passed).length
  const score = Math.round((passedCount / checks.length) * 100)
  return { checks, score, passedCount, wordCount, totalChecks: checks.length }
}

router.post('/linkedin', uploadLinkedin.single('profile'), async (req, res) => {
  const userId = req.user.id
  const pastedText = typeof req.body?.texto === 'string' ? req.body.texto.trim() : ''

  if (!req.file && !pastedText) {
    return res.status(400).json({ error: 'Sube el PDF exportado de LinkedIn o pega el texto de tu perfil.' })
  }

  // Limpiar archivo anterior en Storage si existía (un solo perfil por usuario)
  const { data: existing } = await supabase
    .from('hrm_linkedin_profiles')
    .select('storage_path')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing?.storage_path) {
    await supabase.storage.from('linkedin').remove([existing.storage_path])
  }

  let storagePath = null
  let rawText = pastedText

  if (req.file) {
    storagePath = `${userId}/${Date.now()}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('linkedin')
      .upload(storagePath, req.file.buffer, { contentType: 'application/pdf', upsert: false })
    if (uploadErr) return res.status(500).json({ error: uploadErr.message })

    try {
      rawText = await extractLinkedinText(supabase, { storage_path: storagePath })
    } catch (err) {
      await supabase.storage.from('linkedin').remove([storagePath])
      return res.status(500).json({ error: err.message || 'Error extrayendo texto del PDF' })
    }
  }

  const { data, error } = await supabase
    .from('hrm_linkedin_profiles')
    .upsert({
      user_id: userId,
      storage_path: storagePath,
      raw_text: rawText,
      heuristic_score: null,
      heuristic_checks: null,
      ai_suggestions: null,
      ai_generated_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })

  res.status(201).json(data)
})

router.get('/linkedin', async (req, res) => {
  const { data, error } = await supabase
    .from('hrm_linkedin_profiles')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data || null)
})

router.delete('/linkedin', async (req, res) => {
  const { data: existing } = await supabase
    .from('hrm_linkedin_profiles')
    .select('storage_path')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (existing?.storage_path) {
    await supabase.storage.from('linkedin').remove([existing.storage_path])
  }
  const { error } = await supabase
    .from('hrm_linkedin_profiles')
    .delete()
    .eq('user_id', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
})

// Score heurístico — gratis, sin IA (mismo espíritu que el ATS score).
router.post('/linkedin/score', async (req, res) => {
  const { data: profile, error: fetchErr } = await supabase
    .from('hrm_linkedin_profiles')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (fetchErr || !profile) return res.status(404).json({ error: 'Sube o pega tu perfil de LinkedIn primero.' })

  const analysis = analyzeLinkedinProfile(profile.raw_text)

  await supabase
    .from('hrm_linkedin_profiles')
    .update({ heuristic_score: analysis.score, heuristic_checks: analysis.checks })
    .eq('user_id', req.user.id)

  res.json({
    score: analysis.score,
    totalChecks: analysis.totalChecks,
    passedChecks: analysis.passedCount,
    checks: analysis.checks,
  })
})

// Análisis por industria con IA — requiere plan activo ($99/30 días), 5 usos/mes.
router.post('/linkedin/ai-suggest', async (req, res) => {
  const userId = req.user.id
  const industria = typeof req.body?.industria === 'string' ? req.body.industria.trim() : ''
  if (!industria) return res.status(400).json({ error: 'Elige una industria para el análisis.' })

  const hasAccess = await hasCvPackAccess(supabase, userId, req.user.email)
  if (!hasAccess) {
    return res.status(403).json({
      error: 'Análisis de LinkedIn por industria disponible con el plan de $99 MXN / 30 días.',
      locked: true,
    })
  }

  const isPlanActive = await isProUser(supabase, userId, req.user.email)
  if (isPlanActive) {
    const usage = await checkUsageLimit(supabase, { userId, email: req.user.email, kind: 'linkedin_ai' })
    if (!usage.allowed) {
      return res.status(403).json({
        error: `Alcanzaste el límite de ${usage.limit} análisis de LinkedIn con IA este periodo (${usage.used}/${usage.limit}). Se reinicia cuando renueves tu plan.`,
        locked: true,
        reason: 'usage_limit',
        usage,
      })
    }
  }

  const { data: profile, error: fetchErr } = await supabase
    .from('hrm_linkedin_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (fetchErr || !profile) return res.status(404).json({ error: 'Sube o pega tu perfil de LinkedIn primero.' })

  if (!anthropicEnabled()) {
    return res.status(503).json({ error: 'Análisis con IA no disponible en este momento.' })
  }

  const truncatedText = profile.raw_text.length > 14000
    ? `${profile.raw_text.slice(0, 14000)}\n\n[…texto truncado por longitud…]`
    : profile.raw_text

  const systemPrompt = `Eres un experto en reclutamiento en México, dando una opinión experta (no una simulación del algoritmo real de LinkedIn, que es privado) sobre un perfil de LinkedIn para la industria "${industria}".

OBLIGATORIO:
- Evalúa qué tan bien el titular, el "Acerca de" y la experiencia comunican valor para reclutadores de esa industria específica.
- Sugiere mejoras de redacción concretas (no inventes logros, empresas ni fechas que no estén en el texto).
- Prioriza: uso de palabras clave de la industria, logros cuantificados, claridad del titular.
- Responde ÚNICAMENTE con JSON válido (sin markdown), con esta forma exacta:
{
  "resumen": "2-3 frases: diagnóstico del perfil para esta industria",
  "checklist": ["acción concreta 1", "acción concreta 2", "..."],
  "sugerencias": [
    {
      "seccion": "ej. Titular / Acerca de / Experiencia",
      "prioridad": "alta" | "media" | "baja",
      "problema": "qué falta o no comunica bien para esta industria",
      "accion": "instrucción clara de qué escribir",
      "razon": "por qué importa para reclutadores de esta industria"
    }
  ]
}`

  const userPrompt = `Industria elegida: ${industria}

Texto del perfil de LinkedIn:
---
${truncatedText}
---`

  let normalized
  try {
    const { rawText } = await createAnthropicMessage({
      system: systemPrompt,
      user: userPrompt,
      max_tokens: 2500,
      temperature: 0.3,
    })
    const aiResult = parseJsonFromModelText(rawText)
    normalized = {
      resumen: aiResult.resumen || 'Revisa las sugerencias para mejorar tu perfil frente a esta industria.',
      checklist: Array.isArray(aiResult.checklist) ? aiResult.checklist : [],
      sugerencias: Array.isArray(aiResult.sugerencias) ? aiResult.sugerencias : [],
      industria,
      source: 'anthropic',
    }
  } catch (err) {
    console.error('LinkedIn AI suggest Anthropic error:', err?.message || err)
    return res.status(502).json({ error: 'No se pudo generar el análisis. Intenta de nuevo en unos minutos.' })
  }

  await supabase
    .from('hrm_linkedin_profiles')
    .update({
      industria,
      ai_suggestions: normalized,
      ai_generated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (isPlanActive) {
    await recordUsageEvent(supabase, userId, 'linkedin_ai')
  }

  res.json(normalized)
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

// Creación de cita + notify Tappt — mismo patrón que CRM:
// INSERT → notify fire-and-forget → 201 con la fila (no await Tappt).
router.post('/appointments', async (req, res) => {
  const userId = req.user.id
  const { fecha_cita, descripcion, recruiter_id, ...rest } = req.body || {}

  try {
    // Igual que CRM: fecha local sin zona → -06:00 (México) antes de persistir
    const row = {
      ...rest,
      user_id: userId,
      descripcion: typeof descripcion === 'string' ? descripcion.trim() : descripcion,
      fecha_cita: toMexicoTimestamptz(fecha_cita) || fecha_cita,
      ...(recruiter_id ? { recruiter_id } : {}),
    }

    const { data, error } = await supabase
      .from('hrm_appointments')
      .insert(row)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })

    // Shape "cliente" del CRM; B2C: telefono = candidato (user_metadata)
    const candidate = {
      id: userId,
      razon_social: 'HRM NKUVO',
      nombre_contacto: req.user.user_metadata?.full_name || null,
      telefono: req.user.user_metadata?.telefono || null,
      last_tappt_wa_at: req.user.user_metadata?.last_tappt_wa_at || null,
    }

    const phoneOk = Boolean(normalizeMexicoPhone(candidate.telefono))
    const envOk = tapptEnabled()

    console.log('TAPPT BLOCK REACHED', {
      appointmentId: data.id,
      hasPhone: phoneOk,
      tapptEnabled: envOk,
      useTemplate: true, // confirmación siempre por plantilla Meta
    })

    // Fire-and-forget: notify siempre con use_template (usuarios nuevos sin ventana 24h)
    if (phoneOk && envOk) {
      notifyAppointmentCreated(data, candidate, { supabase })
    }

    if (!phoneOk) {
      return res.status(201).json({
        ...data,
        tappt_notified: false,
        tappt_warning:
          'Cita guardada. No hay un teléfono válido en tu perfil; no se enviará recordatorio WhatsApp. Agrégalo en Configuración.',
      })
    }
    if (!envOk) {
      return res.status(201).json({
        ...data,
        tappt_notified: false,
        tappt_warning:
          'Cita guardada. Recordatorios WhatsApp no configurados en el servidor (TAPPT_API_URL / TAPPT_API_KEY).',
      })
    }

    return res.status(201).json({
      ...data,
      tappt_notified: true,
      tappt_use_template: true,
    })
  } catch (err) {
    console.error('POST /appointments error:', err)
    return res.status(500).json({ error: err.message })
  }
})

router.put('/appointments/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('hrm_appointments')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Cita no encontrada' })

    // Igual que CRM: si se marca completado, cancelar recordatorio en Tappt
    if (data.completado) {
      notifyAppointmentCancelled(data.id)
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Suscripción ───────────────────────────────────────────────────────────
router.get('/subscription', async (req, res) => {
  const isActive = await isProUser(supabase, req.user.id, req.user.email)

  const { data, error } = await supabase
    .from('hrm_subscriptions')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })

  // isProUser ya valida current_period_end (pago único, sin renovación
  // automática) — status crudo de la fila puede seguir en "active" aunque
  // ya haya vencido, así que se corrige aquí antes de responder.
  if (!isActive) {
    return res.json({ ...(data || {}), status: 'free' })
  }
  res.json({ ...(data || {}), status: 'active', plan: data?.plan || 'demo' })
})

// ══════════════════════════════════════════════════════════════════════════
// Admin — panel interno de analítica (/app/admin en el frontend). Solo
// correos en ADMIN_EMAILS (Railway) pueden verlo. No sustituye Meta Events
// Manager (eso mide tráfico/visitas) — esto mide compras y planes reales
// directo de la BD, sin depender de que el pixel haya disparado.
router.get('/admin/stats', async (req, res) => {
  if (!isAdminEmail(req.user.email)) {
    return res.status(403).json({ error: 'No autorizado' })
  }

  try {
    const [
      { count: paidCount },
      { count: pendingCount },
      { data: revenueRows },
      { count: activeBundles },
      { count: totalRecruiters },
      { data: recentPurchases },
    ] = await Promise.all([
      supabase.from('hrm_directory_purchases').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
      supabase.from('hrm_directory_purchases').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('hrm_directory_purchases').select('amount').eq('status', 'paid'),
      supabase.from('hrm_subscriptions').select('user_id', { count: 'exact', head: true })
        .eq('status', 'active').gt('current_period_end', new Date().toISOString()),
      supabase.from('hrm_recruiters').select('id', { count: 'exact', head: true }),
      supabase.from('hrm_directory_purchases').select('email, created_at, status')
        .order('created_at', { ascending: false }).limit(20),
    ])

    const revenue = (revenueRows || []).reduce((sum, r) => sum + (r.amount || 0), 0)
    const totalOrders = (paidCount || 0) + (pendingCount || 0)
    const conversionRate = totalOrders > 0 ? Math.round(((paidCount || 0) / totalOrders) * 100) : null

    res.json({
      paidCount: paidCount || 0,
      pendingCount: pendingCount || 0,
      revenue,
      conversionRate,
      activeBundles: activeBundles || 0,
      totalRecruiters: totalRecruiters || 0,
      recentPurchases: recentPurchases || [],
    })
  } catch (err) {
    console.error('GET /admin/stats error:', err)
    res.status(500).json({ error: err.message || 'Error generando estadísticas' })
  }
})

export default router
