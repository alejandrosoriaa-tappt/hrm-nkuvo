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

export async function isProUser(supabase, userId, email) {
  if (isDemoEmail(email)) return true

  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  return sub?.status === 'active'
}

/** Límite free configurable (env FREE_CONTACT_LIMIT o default 5). */
export function getFreeContactLimit() {
  return FREE_CONTACT_LIMIT
}

/**
 * Acceso al pack "CV IA + ATS Checker" ($149 MXN, pago único): Pro/demo lo
 * incluyen; free lo obtiene comprando el pack (hrm_subscriptions.cv_pack_purchased_at).
 * Gating de ATS-fix y reescritura con IA usa esto en vez de isProUser a secas.
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
