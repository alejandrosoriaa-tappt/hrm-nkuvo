import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, CalendarDays, Building2, FileText,
  Send, BookTemplate, Briefcase, StickyNote, Tag,
  BarChart3, Settings, Moon, Sun, LogOut, Sparkles, CreditCard
} from 'lucide-react'
import useAuthStore from '../store/authStore.js'

const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { to: '/app',             end: true, icon: LayoutDashboard, label: 'Resumen' },
      { to: '/app/contactos',             icon: Users,            label: 'Contactos' },
      { to: '/app/calendario',            icon: CalendarDays,     label: 'Calendario' },
    ]
  },
  {
    label: 'Directorio',
    items: [
      { to: '/app/reclutadoras', icon: Building2, label: 'Reclutadoras' },
      { to: '/app/cvs',          icon: FileText,  label: 'Mis CVs' },
    ]
  },
  {
    label: 'Herramientas',
    items: [
      { to: '/app/envios',        icon: Send,         label: 'Envíos' },
      { to: '/app/plantillas',    icon: BookTemplate, label: 'Plantillas' },
      { to: '/app/oportunidades', icon: Briefcase,    label: 'Oportunidades' },
      { to: '/app/notas',         icon: StickyNote,   label: 'Notas' },
      { to: '/app/etiquetas',     icon: Tag,          label: 'Etiquetas' },
    ]
  },
  {
    label: 'Cuenta',
    items: [
      { to: '/app/membresia',     icon: CreditCard, label: 'Membresía' },
      { to: '/app/reportes',      icon: BarChart3, label: 'Reportes' },
      { to: '/app/configuracion', icon: Settings,  label: 'Configuración' },
    ]
  }
]

export default function Layout() {
  const { user, session, isLoading, logout } = useAuthStore()
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(false)

  if (isLoading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!session || !user) return <Navigate to="/login" replace />

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const toggleDark = () => {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '')
  }

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

  return (
    <div className="page-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <p className="sidebar-logo">
            HRM <span>NKUVO</span>
          </p>
          <p className="sidebar-user">{displayName}</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="sidebar-nav-section-label">{section.label}</p>
              <div className="sidebar-nav-items">
                {section.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `nav-link${isActive ? ' active' : ''}`
                    }
                  >
                    <item.icon size={16} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-ghost btn-sm w-full" style={{ borderRadius: 12, justifyContent: 'flex-start' }} onClick={toggleDark}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button className="btn btn-ghost btn-sm w-full" style={{ borderRadius: 12, justifyContent: 'flex-start' }} onClick={handleLogout}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="main-content">
        <main className="page-inner">
          <Outlet />
        </main>

        {/* Botón flotante de asistente */}
        <button className="fab" title="Asistente (próximamente)">
          <Sparkles size={18} />
        </button>
      </div>
    </div>
  )
}
