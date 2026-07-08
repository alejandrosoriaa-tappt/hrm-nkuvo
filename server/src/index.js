import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import hrmRoutes from './routes/hrm.js'
import authRoutes from './routes/auth.js'
import billingRoutes from './routes/billing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())
app.use(express.json())
app.use(rateLimit({ windowMs: 60_000, max: 120 }))

// ── Health check — antes de cualquier otra ruta ──────────────────────────
app.get('/health', (req, res) => res.json({ ok: true }))

// ── API — billing ANTES de /api/hrm para que no lo capture el router HRM ─
// /api/hrm/billing/* empezaría a matchear en hrmRoutes (prefijo /api/hrm)
// antes de llegar al billingRouter, bloqueándose con authMiddleware. El orden
// correcto es: billing primero, luego el router genérico de HRM.
app.use('/api/hrm/billing', billingRoutes)
app.use('/api/hrm', hrmRoutes)
app.use('/api/auth', authRoutes)

// ── Frontend estático (web/dist) ─────────────────────────────────────────
// Un solo servicio de Railway sirve la API y el build estático de web/ —
// evita pagar por un segundo servicio solo para el frontend.
const webDist = path.join(__dirname, '../../web/dist')
app.use(express.static(webDist))
app.get('*', (req, res) => {
  const indexFile = path.join(webDist, 'index.html')
  res.sendFile(indexFile, (err) => {
    if (err) {
      // web/dist no existe todavía (build pendiente) — respuesta de diagnóstico
      res.status(503).json({
        error: 'Frontend build not found. Run: npm run build',
        hint: 'web/dist/index.html is missing'
      })
    }
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`HRM server listening on :${PORT}`))
