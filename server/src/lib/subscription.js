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
 * Valida si un usuario free puede crear otro contacto en hrm_contacts.
 * Pro / demo: siempre permitido. Free: máximo FREE_CONTACT_LIMIT filas.
 *
 * @returns {{ allowed: boolean, isPro: boolean, count: number, limit: number }}
 */
export async function checkContactLimit(supabase, userId, email) {
  const isPro = await isProUser(supabase, userId, email)
  const limit = getFreeContactLimit()

  if (isPro) {
    return { allowed: true, isPro: true, count: 0, limit }
  }

  const { count, error } = await supabase
    .from('hrm_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    // Falla cerrada: no permitir el insert si no podemos contar
    throw new Error(error.message)
  }

  const current = count || 0
  return {
    allowed: current < limit,
    isPro: false,
    count: current,
    limit,
  }
}
