import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/admin/dashboard', label: '📊 Dashboard' },
  { to: '/admin/persons', label: '👥 Students' },
  { to: '/admin/groups', label: '🏫 Classes' },
  { to: '/admin/attendance', label: '✅ Attendance' },
  { to: '/admin/leave-requests', label: '📋 Leave Requests' },
  { to: '/admin/announcements', label: '📢 Announcements' },
  { to: '/admin/reports', label: '📈 Reports' },
  { to: '/admin/channels', label: '📱 Channels' },
  { to: '/admin/undeliverable', label: '⚠️ Undeliverable' },
  { to: '/admin/holidays', label: '🗓️ Holidays' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: '1.25rem 1rem 1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Avento</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Panel</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 0.5rem', flex: 1 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...navLinkStyle,
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: isActive ? '#60a5fa' : '#94a3b8',
                borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.5rem' }}>{user?.email}</p>
          <button onClick={() => void logout()} style={logoutBtnStyle}>
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '2rem', background: '#f8fafc', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

const sidebarStyle: React.CSSProperties = {
  width: '240px',
  background: '#0f172a',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
}

const navLinkStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  textDecoration: 'none',
  transition: 'all 0.15s ease',
}

const logoutBtnStyle: React.CSSProperties = {
  background: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#f87171',
  padding: '0.4rem 0.8rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  width: '100%',
}
