import axios from 'axios'
import supabase from './supabase.js'

const env = window.__env__ || {}
const api = axios.create({
  baseURL: env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Mismo patrón de interceptors que crm/src/lib/api.js: adjunta el token de
// Supabase a cada request y reintenta una vez tras refrescar sesión en 401.
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session) {
        error.config.headers.Authorization = `Bearer ${session.access_token}`
        return api.request(error.config)
      }
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Endpoints propuestos según el alcance de MVP acordado (directorio freemium,
// seguimiento de contacto, CVs con checker ATS, agenda). Ajustar conforme se
// defina el esquema real en el backend.
export const hrmAPI = {
  // Directorio de reclutadoras
  listRecruiters:       (params)   => api.get('/api/hrm/recruiters', { params }),
  getRecruiter:         (id)       => api.get(`/api/hrm/recruiters/${id}`),

  // Seguimiento de contacto (candidato <-> reclutadora)
  listContacts:         (params)   => api.get('/api/hrm/contacts', { params }),
  createContact:        (data)     => api.post('/api/hrm/contacts', data),
  updateContact:        (id, data) => api.put(`/api/hrm/contacts/${id}`, data),
  deleteContact:        (id)       => api.delete(`/api/hrm/contacts/${id}`),

  // CVs (hasta 5 variantes, Supabase Storage)
  listCvs:              ()         => api.get('/api/hrm/cvs'),
  uploadCv:             (formData) => api.post('/api/hrm/cvs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteCv:              (id)      => api.delete(`/api/hrm/cvs/${id}`),
  checkCvAts:            (id, jobDescription) =>
    api.post(`/api/hrm/cvs/${id}/ats-check`, { jobDescription }),

  // Agenda / citas
  listAppointments:      (params)  => api.get('/api/hrm/appointments', { params }),
  createAppointment:     (data)    => api.post('/api/hrm/appointments', data),
  updateAppointment:     (id, data)=> api.put(`/api/hrm/appointments/${id}`, data),

  // Envío de correo con CV adjunto
  sendCvEmail:           (data)    => api.post('/api/hrm/emails/send-cv', data),

  // Suscripción / estado de cuenta
  getSubscription:       ()        => api.get('/api/hrm/subscription'),
}

export default api
