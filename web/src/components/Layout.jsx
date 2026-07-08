import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ListChecks, Building2, FileText, CalendarDays, Settings,
  Moon, LogOut, Sparkles
} from 'lucide-react'
import useAuthStore from '../store/authStore.js'

// Estructura de sidebar inspirada en el dashboard de Tappt Business
// (secciones agrupadas con encabezado en mayúsculas, item activo con fondo
// sólido, toggle de modo oscuro y cerrar sesión al fondo). A diferencia del
// Layout del CRM de NKUVO (header horizontal), aquí es sidebar vertical fija.
const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { to: '/app', end: true, icon: LayoutDashboard, label: 'Inicio' },
      { to: '/app/seguimiento', icon: ListChecks, label: 'Seguimiento' },
    ]
  },
  {
    label: 'Directorio',
    items: [
      { to: '/app/reclutadoras', icon: Building2, label: 'Reclutadoras' },
    ]
  },
  {
    label: 'Herramientas',
    items: [
      { to: '/app/cvs', icon: FileText, label: 'Mis CVs' },
      { to: '/app/agenda', icon: CalendarDays, label: 'Agenda' },
      { to: '/app/configuracion', icon: Settings, label: 'Configuración' },
    ]
  }
]

export default function Layout() {
  const { user, session, isLoading, logout } = useAuthStore()
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-hrm-surface flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-hrm-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session || !user) return <Navigate to="/login" replace />

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

  const navClass = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-hrm-primary text-hrm-on-primary shadow-md3-1'
        : 'text-hrm-on-surface-variant hover:bg-hrm-surface-container'
    }`

  return (
    <div className={`min-h-screen flex ${darkMode ? 'dark' : ''}`}>

      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-hrm-outline-variant/40 flex flex-col">
        <div className="px-4 py-5">
          <p className="font-bold text-hrm-on-surface leading-tight">
            HRM <span className="text-hrm-primary">NKUVO</span>
          </p>
          <p className="text-xs text-hrm-on-surface-variant mt-0.5">{displayName}</p>
        </div>

        <nav className="flex-1 px-3 space-y-5 overflow-y-auto">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold tracking-wide uppercase text-hrm-on-surface-variant/70">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                    <item.icon size={16} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 space-y-1 border-t border-hrm-outline-variant/40">
          <button
            onClick={() => setDarkMode(d => !d)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-hrm-on-surface-variant hover:bg-hrm-surface-container transition-colors"
          >
            <Moon size={16} />
            Modo oscuro
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-hrm-on-surface-variant hover:bg-hrm-surface-container transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 bg-hrm-surface min-h-screen relative">
        <main className="p-6 max-w-6xl mx-auto">
          <Outlet />
        </main>

        {/* Botón flotante de asistente — mismo patrón que el dashboard de
            Tappt Business (esquina inferior derecha). Sin funcionalidad aún. */}
        <button
          title="Asistente"
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-hrm-primary text-hrm-on-primary shadow-md3-3 flex items-center justify-center hover:shadow-md3-4 transition-shadow"
        >
          <Sparkles size={18} />
        </button>
      </div>
    </div>
  )
}
