import { create } from 'zustand'
import supabase from '../lib/supabase.js'

// Adaptado de crm/src/store/authStore.js — mismo patrón de Google OAuth +
// email/password, más signUp() porque a diferencia del CRM (login interno,
// acceso restringido por CRM_ALLOWED_EMAILS) el HRM es B2C: cualquiera puede
// crear cuenta.
const useAuthStore = create((set) => ({
  user: null,
  session: null,
  isLoading: true,
  error: null,

  loginWithGoogle: async () => {
    const redirectTo = window.location.origin + '/app'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        set({ isLoading: false, error: error.message })
        return { success: false, error: error.message }
      }

      set({
        user: data.user,
        session: data.session,
        isLoading: false,
        error: null
      })

      return { success: true }
    } catch (err) {
      set({ isLoading: false, error: err.message })
      return { success: false, error: err.message }
    }
  },

  signUp: async (email, password, fullName) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })

      if (error) {
        set({ isLoading: false, error: error.message })
        return { success: false, error: error.message }
      }

      set({
        user: data.user,
        session: data.session,
        isLoading: false,
        error: null
      })

      // Si Supabase requiere confirmación de correo, data.session viene null
      // aquí y el usuario debe verificar su correo antes de poder iniciar sesión.
      return { success: true, needsEmailConfirmation: !data.session }
    } catch (err) {
      set({ isLoading: false, error: err.message })
      return { success: false, error: err.message }
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Logout error:', err.message)
    }
    set({ user: null, session: null, isLoading: false, error: null })
  },

  initialize: async () => {
    set({ isLoading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({
        user: session?.user || null,
        session: session || null,
        isLoading: false
      })
    } catch (err) {
      console.error('Auth initialization error:', err)
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null })
}))

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    useAuthStore.setState({ user: null, session: null, isLoading: false })
  } else if (session) {
    useAuthStore.setState({ session, user: session.user, isLoading: false })
  }
})

export default useAuthStore
