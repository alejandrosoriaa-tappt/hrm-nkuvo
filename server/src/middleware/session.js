import { createClient } from '@supabase/supabase-js'

// Sesión única por dispositivo: valida que el X-Session-Token del cliente
// coincida con el token activo en hrm_sessions. Si no coincide (el usuario
// inició sesión en otro dispositivo) → 401 y fuerza re-login.
// Debe montarse DESPUÉS de authMiddleware (req.user ya está disponible).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function sessionMiddleware(req, res, next) {
  const clientToken = req.headers['x-session-token']

  if (!clientToken) {
    // Si el cliente no manda token todavía (primera request tras OAuth), permitir
    // pero no hacer nada — el token se creará en el login endpoint.
    return next()
  }

  try {
    const { data, error } = await supabase
      .from('hrm_sessions')
      .select('session_token')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (error) {
      console.error('sessionMiddleware DB error:', error)
      return next() // falla abierta: no bloquear por error de BD
    }

    if (data && data.session_token !== clientToken) {
      return res.status(401).json({
        error: 'Tu cuenta se abrió en otro dispositivo. Inicia sesión de nuevo.',
        code: 'SESSION_CONFLICT'
      })
    }

    next()
  } catch (err) {
    console.error('sessionMiddleware error:', err)
    next()
  }
}
