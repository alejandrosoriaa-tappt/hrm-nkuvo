// Helper compartido: reemplaza el bloque de consulta a hrm_subscriptions
// copy-pasteado en varias rutas de hrm.js.
export async function isProUser(supabase, userId) {
  const { data: sub } = await supabase
    .from('hrm_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  return sub?.status === 'active'
}
