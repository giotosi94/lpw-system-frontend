import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, FileText, ClipboardList, LayoutDashboard, Menu, X, BookOpen, Cog, Columns, Users, LogOut, AlertTriangle, Library } from 'lucide-react'
import { useState } from 'react'
import { APP_NAME } from '../config/app'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { user, logout, isAdmin } = useAuth()

  const links = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/kaizen', icon: FileText, label: 'Kaizen' },
    { to: '/action-plan', icon: ClipboardList, label: 'Action Plan' },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Meetings' },
    { to: '/pillars', icon: Columns, label: 'Pillars' },
    { to: '/documenti', icon: BookOpen, label: 'Documenti' },
    { to: '/segnalazioni', icon: AlertTriangle, label: 'Segnalazioni' },
    { to: '/wiki', icon: Library, label: 'Wiki Architettura' },
    ...(isAdmin ? [{ to: '/users', icon: Users, label: 'Utenti' }] : []),
    { to: '/settings', icon: Cog, label: 'Settings' },
  ]

  function handleLogout() {
    if (confirm('Vuoi davvero uscire?')) {
      logout()
      navigate('/login')
    }
  }

  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map(value => value[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  const roleColors = {
    admin: 'bg-red-500',
    manager: 'bg-purple-500',
    office: 'bg-blue-500',
    operator: 'bg-green-500',
  }

  const roleColor = roleColors[user?.role] || 'bg-gray-500'

  return (
    <div className="flex h-screen bg-background text-warm-text">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } bg-primary text-white transition-all duration-300 flex flex-col shadow-warm-lg`}
      >
        <div className="p-4 flex justify-between items-center border-b border-primary-light">
          {sidebarOpen && (
            <h1 className="text-lg font-bold">
              {APP_NAME}
            </h1>
          )}

          <button
            type="button"
            onClick={() => setSidebarOpen(current => !current)}
            className="text-white hover:bg-primary-light p-1 rounded"
            title={sidebarOpen ? 'Riduci menu' : 'Espandi menu'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {links.map(link => {
            const Icon = link.icon
            const isActive =
              location.pathname === link.to ||
              (link.to !== '/' && location.pathname.startsWith(link.to))

            return (
              <Link
                key={link.to}
                to={link.to}
                title={!sidebarOpen ? link.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gold-dark text-white shadow-warm-sm'
                    : 'hover:bg-chocolate-light'
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {sidebarOpen && (
                  <span className="text-sm">
                    {link.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-primary-light p-3 space-y-2">
          <NotificationBell sidebarOpen={sidebarOpen} />

          {user && (
            <div
              className={`flex items-center gap-3 px-2 py-2 rounded-lg ${
                sidebarOpen ? 'bg-primary-light bg-opacity-50' : ''
              }`}
            >
              <div
                className={`${roleColor} text-white rounded-full w-9 h-9 flex items-center justify-center font-bold text-sm flex-shrink-0`}
                title={!sidebarOpen ? user.full_name : undefined}
              >
                {userInitials}
              </div>

              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {user.full_name}
                  </div>
                  <div className="text-xs text-gray-300 truncate capitalize">
                    {user.role}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500 hover:bg-opacity-70 transition-colors text-sm"
            title="Logout"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>

          {sidebarOpen && (
            <div className="text-xs text-gray-300 text-center">
              {`${APP_NAME} v1.0`}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
