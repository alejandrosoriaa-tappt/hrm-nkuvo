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

app.use('/api/hrm', hrmRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/hrm/billing', billingRoutes)

app.get('/health', (req, res) => res.json({ ok: true }))

// Un solo servicio de Railway sirve la API y el build estático de web/ —
// evita pagar por un segundo servicio solo para el frontend (ver decisión
// de arquitectura en README.md).
const webDist = path.join(__dirname, '../../web/dist')
app.use(express.static(webDist))
app.get('*', (req, res) => res.sendFile(path.join(webDist, 'index.html')))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`HRM server listening on :${PORT}`))
