import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { authMiddleware } from '../middleware/auth.js'

// Endpoint que el cliente llama TRAS el login de Supabase para:
//   1. Generar un nuevo session_token y guardarlo en hrm_sessions
//   2. Invalidar cualquier token anterior (un dispositivo activo a la vez)
//   3. Devolver el token al cliente (se guarda en localStorage)
//
// El cliente lo llama con su JWT de Supabase en Authorization header.
const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

router.post('/session', authMiddleware, async (req, res) => {
  try {
    const token = randomBytes(32).toString('hex')
    const userAgent = req.headers['user-agent'] || null

    // upsert: crea o reemplaza (invalida el anterior automáticamente)
    const { error } = await supabase
      .from('hrm_sessions')
      .upsert(
        { user_id: req.user.id, session_token: token, user_agent: userAgent, created_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('session upsert error:', error)
      return res.status(500).json({ error: 'Error creando sesión' })
    }

    res.json({ sessionToken: token })
  } catch (err) {
    console.error('POST /session error:', err)
    res.status(500).json({ error: 'Error interno' })
  }
})

router.delete('/session', authMiddleware, async (req, res) => {
  try {
    await supabase
      .from('hrm_sessions')
      .delete()
      .eq('user_id', req.user.id)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: 'Error cerrando sesión' })
  }
})

export default router
