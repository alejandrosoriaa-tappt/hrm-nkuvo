// Helper compartido: reemplaza el bloque de consulta a hrm_subscriptions
// copy-pasteado en varias rutas de hrm.js.
//
// Cuentas demo: correos listados en DEMO_EMAILS (Railway) se tratan como Pro
// sin pasar por Clip — para mostrar el producto completo en ventas/redes
// sin depender de una suscripción real.
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
