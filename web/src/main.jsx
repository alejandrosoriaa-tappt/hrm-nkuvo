import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './theme.css'
import useAuthStore from './store/authStore.js'

// Inicializa la sesión de Supabase antes de renderizar para evitar flicker
// de la pantalla de login cuando el usuario ya tiene sesión activa.
useAuthStore.getState().initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
