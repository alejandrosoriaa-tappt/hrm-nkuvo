import axios from 'axios'
import supabase from './supabase.js'
import { SESSION_TOKEN_KEY } from '../store/authStore.js'

const env = window.__env__ || {}
const api = axios.create({
  baseURL: env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Adjunta JWT de Supabase + X-Session-Token (sesión única por dispositivo)
// en cada request.
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY)
    if (sessionToken) {
      config.headers['X-Session-Token'] = sessionToken
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Sesión abierta en otro dispositivo → logout forzado
    if (error.response?.data?.code === 'SESSION_CONFLICT') {
      localStorage.removeItem(SESSION_TOKEN_KEY)
      await supabase.auth.signOut()
      window.location.href = '/login?reason=session_conflict'
      return Promise.reject(error)
    }

    // JWT expirado → refrescar y reintentar una vez
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session) {
        error.config.headers.Authorization = `Bearer ${session.access_token}`
        return api.request(error.config)
      }
      await supabase.auth.signOut()
      localStorage.removeItem(SESSION_TOKEN_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ── Endpoints del HRM ────────────────────────────────────────────────────
export const hrmAPI = {
  // Directorio (lista NUNCA devuelve email/teléfono — ver backend)
  listRecruiters:        (params)    => api.get('/api/hrm/recruiters', { params }),
  getRecruiter:          (id)        => api.get(`/api/hrm/recruiters/${id}`),

  // Seguimiento de contacto
  listContacts:          (params)    => api.get('/api/hrm/contacts', { params }),
  getContactQuota:       ()          => api.get('/api/hrm/contacts/quota'),
  createContact:         (data)      => api.post('/api/hrm/contacts', data),
  updateContact:         (id, data)  => api.put(`/api/hrm/contacts/${id}`, data),
  deleteContact:         (id)        => api.delete(`/api/hrm/contacts/${id}`),

  // CVs (hasta 5 variantes, Supabase Storage)
  listCvs:               ()          => api.get('/api/hrm/cvs'),
  uploadCv:              (formData)  => api.post('/api/hrm/cvs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteCv:              (id)        => api.delete(`/api/hrm/cvs/${id}`),
  checkCvAts:            (id)        => api.post(`/api/hrm/cvs/${id}/ats-check`),
  // Sugerir con IA: formato/estructura ATS (Pro). Mantiene path /rewrite por compatibilidad.
  rewriteCv:             (id, contexto) => api.post(`/api/hrm/cvs/${id}/rewrite`, { contexto }),

  // Agenda / citas
  listAppointments:      (params)    => api.get('/api/hrm/appointments', { params }),
  createAppointment:     (data)      => api.post('/api/hrm/appointments', data),
  updateAppointment:     (id, data)  => api.put(`/api/hrm/appointments/${id}`, data),

  // Suscripción (estado simple — usado en Resumen y Reclutadoras)
  getSubscription:       ()          => api.get('/api/hrm/subscription'),

  // Billing Clip
  getBillingStatus:      ()          => api.get('/api/hrm/billing/status'),
  startCheckout:         ()          => api.post('/api/hrm/billing/checkout'),
  cancelSubscription:    ()          => api.post('/api/hrm/billing/cancel'),
}

export default api
