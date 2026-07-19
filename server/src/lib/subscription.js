// Helper compartido: suscripción Pro + límite freemium de contactos.
//
// Cuentas demo: correos listados en DEMO_EMAILS (Railway) se tratan como Pro
// sin pasar por Clip — para mostrar el producto completo en ventas/redes
// sin depender de una suscripción real.

/** Máximo de contactos / desbloqueos para usuarios free. */
export const FREE_CONTACT_LIMIT = Number(process.env.FREE_CONTACT_LIMIT) || 5

function isDemoEmail(email) {
  const demoEmails = (process.env.DEMO_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return Boolean(email && demoEmails.includes(email.toLowerCase()))
}

/**
 * Correos con acceso al panel de analítica interno (/app/admin, ver
 * GET /api/hrm/admin/stats en hrm.js). Configurar ADMIN_EMAILS en Railway
 * (mismo formato que DEMO_EMAILS, separado por comas).
 */
export function isAdminEmail(email) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return Boolean(email && adminEmails.includes(email.toLowerCase()))
}

/** Máximo de usos mensuales de funciones de IA limitadas del plan (ATS rewrite, LinkedIn IA). */
export const AI_USAGE_MONTHLY_LIMIT = Number(process.env.AI_USAGE_MONTHLY_LIMIT) || 5

/**
 * true si el usuario tiene el plan activo ($99/30 días) vigente.
 * A diferencia del viejo modelo de suscripción recurrente, aquí SIEMPRE se
 * valida current_period_end porque el pago es único (sin webhook de
 * renovación automática que reponga el status) — quien no vuelve a pagar
 * queda free al vencer.
 */
export async function isProUser(supabase, userId, email) {
  if (isDemoEmail(email)) return true

  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  if (sub?.status !== 'active') return false
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false
  return true
}

/** Límite free configurable (env FREE_CONTACT_LIMIT o default 5). */
export function getFreeContactLimit() {
  return FREE_CONTACT_LIMIT
}

/**
 * Acceso a funciones de IA del plan (ATS rewrite, LinkedIn IA, "cómo
 * arreglarlo" del ATS check). El plan activo ($99/30 días) lo incluye.
 * También reconoce compras del viejo pack "CV IA + ATS Checker" ($149,
 * descontinuado 18 jul 2026) para no quitarle el acceso a quien ya pagó:
 * ese pack era de por vida, así que sigue vigente aunque ya no se venda.
 */
export async function hasCvPackAccess(supabase, userId, email) {
  if (await isProUser(supabase, userId, email)) return true

  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('cv_pack_purchased_at')
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(sub?.cv_pack_purchased_at)
}

/**
 * Ventana de conteo del uso de IA del periodo actual (current_period_start).
 * null si el usuario no tiene plan activo (nada que contar).
 */
async function getPeriodStart(supabase, userId, email) {
  if (isDemoEmail(email)) return new Date(0).toISOString() // demo: nunca limitado
  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('current_period_start')
    .eq('user_id', userId)
    .maybeSingle()
  return sub?.current_period_start || null
}

/**
 * Estado de uso de una función de IA limitada (kind: 'ats_rewrite' | 'linkedin_ai')
 * dentro del periodo de 30 días vigente.
 * @returns {{ allowed: boolean, used: number, limit: number }}
 */
export async function checkUsageLimit(supabase, { userId, email, kind }) {
  if (isDemoEmail(email)) return { allowed: true, used: 0, limit: AI_USAGE_MONTHLY_LIMIT }

  const periodStart = await getPeriodStart(supabase, userId, email)
  if (!periodStart) return { allowed: false, used: 0, limit: AI_USAGE_MONTHLY_LIMIT }

  const { count, error } = await supabase
    .from('hrm_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('created_at', periodStart)

  if (error) throw new Error(error.message)
  const used = count || 0
  return { allowed: used < AI_USAGE_MONTHLY_LIMIT, used, limit: AI_USAGE_MONTHLY_LIMIT }
}

/** Registra un uso de función de IA limitada. Llamar solo tras un uso exitoso. */
export async function recordUsageEvent(supabase, userId, kind) {
  await supabase.from('hrm_usage_events').insert({ user_id: userId, kind })
}

/**
 * Cuenta filas en hrm_contacts para un usuario.
 * Falla de forma cerrada si Supabase no devuelve un número.
 */
export async function countUserContacts(supabase, userId) {
  const { count, error } = await supabase
    .from('hrm_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  if (typeof count !== 'number') {
    throw new Error('No se pudo contar contactos (count inválido)')
  }
  return count
}

/**
 * Cuenta desbloqueos en hrm_unlocked_recruiters.
 * Falla cerrada si count no es número.
 */
export async function countUserUnlocks(supabase, userId) {
  const { count, error } = await supabase
    .from('hrm_unlocked_recruiters')
    .select('recruiter_id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  if (typeof count !== 'number') {
    throw new Error('No se pudo contar desbloqueos (count inválido)')
  }
  return count
}

/**
 * Estado del cupo freemium de contactos (sin check de unlock).
 * @returns {{ allowed: boolean, isPro: boolean, count: number, limit: number, remaining: number|null }}
 */
export async function checkContactLimit(supabase, userId, email) {
  const isPro = await isProUser(supabase, userId, email)
  const limit = getFreeContactLimit()

  if (isPro) {
    return { allowed: true, isPro: true, count: 0, limit, remaining: null }
  }

  const current = await countUserContacts(supabase, userId)
  return {
    allowed: current < limit,
    isPro: false,
    count: current,
    limit,
    remaining: Math.max(0, limit - current),
  }
}

/**
 * Dual check obligatorio antes de insertar en hrm_contacts:
 * 1) free: count(hrm_contacts) < FREE_CONTACT_LIMIT
 * 2) free: recruiter_id ya en hrm_unlocked_recruiters
 * Pro/demo: siempre ok.
 *
 * @returns
 *   | { ok: true, isPro, count, limit, remaining }
 *   | { ok: false, status: number, body: object }
 */
export async function assertCanCreateContact(supabase, { userId, email, recruiterId }) {
  const limit = getFreeContactLimit()

  if (!recruiterId || typeof recruiterId !== 'string') {
    return {
      ok: false,
      status: 400,
      body: { error: 'recruiter_id es requerido' },
    }
  }

  const isPro = await isProUser(supabase, userId, email)
  if (isPro) {
    return { ok: true, isPro: true, count: 0, limit, remaining: null }
  }

  let count
  try {
    count = await countUserContacts(supabase, userId)
  } catch (err) {
    return {
      ok: false,
      status: 500,
      body: { error: err.message || 'No se pudo validar el límite de contactos' },
    }
  }

  if (count >= limit) {
    return {
      ok: false,
      status: 403,
      body: {
        error: `Has alcanzado el límite de ${limit} contactos del plan gratuito (${count}/${limit}). Suscríbete a Pro para agregar contactos ilimitados.`,
        locked: true,
        reason: 'contact_limit',
        limit,
        count,
        remaining: 0,
        plan: 'free',
      },
    }
  }

  const { data: unlocked, error: unlockErr } = await supabase
    .from('hrm_unlocked_recruiters')
    .select('recruiter_id')
    .eq('user_id', userId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle()

  if (unlockErr) {
    return {
      ok: false,
      status: 500,
      body: { error: 'No se pudo validar el desbloqueo del reclutador' },
    }
  }

  if (!unlocked) {
    return {
      ok: false,
      status: 403,
      body: {
        error: `Debes desbloquear este reclutador primero (máximo ${limit} gratis en el plan free). Abre su ficha en el directorio o suscríbete a Pro.`,
        locked: true,
        reason: 'not_unlocked',
        limit,
        count,
        remaining: Math.max(0, limit - count),
        plan: 'free',
      },
    }
  }

  return {
    ok: true,
    isPro: false,
    count,
    limit,
    remaining: Math.max(0, limit - count),
  }
}
