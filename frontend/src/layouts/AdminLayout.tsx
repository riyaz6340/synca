import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Mobile Header */}
      <div className="admin-mobile-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '50px',
        background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem',
        alignItems: 'center', justifyContent: 'space-between', zIndex: 999, display: 'none',
      }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '1.2rem', cursor: 'pointer' }}>☰</button>
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>Avento</h2>
        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{user?.email?.split('@')[0]}</span>
      </div>

      {/* Overlay */}
      {menuOpen && (
        <div className="admin-overlay" onClick={() => setMenuOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'none',
        }}></div>
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`} style={{
        width: '220px', minWidth: '220px', background: '#0f172a', color: '#fff',
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
      }}>
        <div style={{ padding: '1.25rem 1rem 1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Avento</h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Panel</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 0.5rem', flex: 1, overflowY: 'auto' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                padding: '0.6rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem',
                textDecoration: 'none', transition: 'all 0.15s',
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: isActive ? '#60a5fa' : '#94a3b8',
                borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                display: 'block',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
          <button onClick={() => void logout()} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', padding: '0.4rem 0.8rem', borderRadius: '6px',
            cursor: 'pointer', fontSize: '0.8rem', width: '100%',
          }}>Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main" style={{ flex: 1, padding: '1.5rem', background: '#f8fafc', overflowY: 'auto', overflowX: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  )
}
