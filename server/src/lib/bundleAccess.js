// Provisiona acceso al plan $99/30 días para un correo SIN pedirle
// contraseña: crea (o reusa) la cuenta de Supabase Auth vía
// auth.admin.generateLink({ type: 'magiclink' }) — esa llamada crea el
// usuario si no existe — y activa hrm_subscriptions para ese user_id. El
// frontend consume el token_hash devuelto con
// supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) para loguear
// sin salir de la página de "gracias".
export async function grantBundleAccess(supabase, { email, paymentId }) {
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr) throw new Error(linkErr.message)

  const userId = linkData.user.id
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  const { error: subErr } = await supabase
    .from('hrm_subscriptions')
    .upsert({
      user_id: userId,
      status: 'active',
      plan: 'bundle_30d',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      clip_order_id: paymentId || null,
      clip_customer_email: email,
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' })
  if (subErr) throw new Error(subErr.message)

  return {
    userId,
    tokenHash: linkData.properties.hashed_token,
    tokenType: 'magiclink',
  }
}

// Regenera un magic link fresco para un correo que YA tiene cuenta y plan
// activo (usado por /lookup cuando el token original ya expiró o Clip no
// regresó al comprador a /directorio/gracias a tiempo). No toca
// hrm_subscriptions — solo re-emite el token de acceso sin contraseña.
export async function regenerateMagicLink(supabase, email) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (error) throw new Error(error.message)
  return { tokenHash: data.properties.hashed_token, tokenType: 'magiclink' }
}
