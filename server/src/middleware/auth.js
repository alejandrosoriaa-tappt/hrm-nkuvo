import { createClient } from '@supabase/supabase-js'

// Copiado tal cual de backend/src/middleware/auth.js — valida el JWT de
// Supabase (mismo proyecto compartido con NKUVO/Tappt) y expone req.user.
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.split(' ')[1]

    const { data: { user }, error } = await supabaseAnon.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = user
    req.token = token
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
