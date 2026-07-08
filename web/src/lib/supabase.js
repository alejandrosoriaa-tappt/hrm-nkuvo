import { createClient } from '@supabase/supabase-js'

// Mismo patrón que crm/src/lib/supabase.js: window.__env__ permite inyectar
// config en runtime (Railway) sin rebuild, con fallback a las env vars de Vite
// para desarrollo local.
const env = window.__env__ || {}
const supabaseUrl = env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default supabase
