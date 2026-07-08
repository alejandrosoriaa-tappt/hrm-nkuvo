import { create } from 'zustand'
import supabase from '../lib/supabase.js'

const SESSION_TOKEN_KEY = 'hrm_session_token'

// Solicita al backend un nuevo session_token (sesión única por dispositivo).
// El backend guarda el token en hrm_sessions e invalida el anterior.
async function createServerSession(accessToken) {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    })
    if (!res.ok) return null
    const { sessionToken } = await res.json()
    if (sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
    }
    return sessionToken
  } catch {
    return null
  }
}

async function deleteServerSession(accessToken) {
  try {
    await fetch('/api/auth/session', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    })
  } catch { /* best effort */ }
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

const useAuthStore = create((set, get) => ({
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
      set({ user: data.user, session: data.session, isLoading: false, error: null })
      // Registrar sesión en el backend (un dispositivo activo a la vez)
      await createServerSession(data.session.access_token)
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
      set({ user: data.user, session: data.session, isLoading: false, error: null })
      if (data.session) {
        await createServerSession(data.session.access_token)
      }
      return { success: true, needsEmailConfirmation: !data.session }
    } catch (err) {
      set({ isLoading: false, error: err.message })
      return { success: false, error: err.message }
    }
  },

  logout: async () => {
    set({ isLoading: true })
    const { session } = get()
    if (session?.access_token) {
      await deleteServerSession(session.access_token)
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY)
    }
    try { await supabase.auth.signOut() } catch (err) { console.warn('Logout error:', err.message) }
    set({ user: null, session: null, isLoading: false, error: null })
  },

  initialize: async () => {
    set({ isLoading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ user: session?.user || null, session: session || null, isLoading: false })
      // Si recuperamos sesión y no hay token local, creamos uno (primer acceso post-OAuth)
      if (session && !localStorage.getItem(SESSION_TOKEN_KEY)) {
        await createServerSession(session.access_token)
      }
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

export { SESSION_TOKEN_KEY }
export default useAuthStore
