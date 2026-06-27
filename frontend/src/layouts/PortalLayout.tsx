import { NavLink, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeToPush, isPushSubscribed } from '../utils/pushNotifications'

export default function PortalLayout() {
  const { user, logout } = useAuth()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => { void isPushSubscribed().then(setPushEnabled) }, [])

  async function handleEnablePush() {
    setEnabling(true)
    const success = await subscribeToPush()
    setPushEnabled(success)
    setEnabling(false)
    if (success) alert('🔔 Notifications enabled!')
    else alert('Could not enable. Please allow notifications in browser settings.')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.3rem' }}>📚</span>
          <h1 style={{ fontSize: '1rem', color: '#1e293b', margin: 0, fontWeight: 700 }}>Avento</h1>
        </div>

        <nav style={navStyle}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              ...navLinkStyle,
              color: isActive ? '#4f46e5' : '#64748b',
              borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
              fontWeight: isActive ? 600 : 400,
            })}>
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!pushEnabled && (
            <button onClick={() => void handleEnablePush()} disabled={enabling} style={alertBtn}>
              🔔 {enabling ? '...' : 'Alerts'}
            </button>
          )}
          {pushEnabled && <span style={{ fontSize: '0.75rem', color: '#10b981' }}>🔔</span>}
          <button onClick={() => void logout()} style={logoutBtn}>↪ Logout</button>
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: '1.25rem', maxWidth: '900px', margin: '0 auto' }}>
        <Outlet />
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav style={mobileNav}>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
            ...mobileNavItem,
            color: isActive ? '#4f46e5' : '#94a3b8',
          })}>
            <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
            <span style={{ fontSize: '0.6rem' }}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

const navItems = [
  { to: '/portal/persons', label: 'Home', icon: '🏠' },
  { to: '/portal/notifications', label: 'Alerts', icon: '🔔' },
  { to: '/portal/announcements', label: 'News', icon: '📢' },
  { to: '/portal/leave-requests', label: 'Leave', icon: '📋' },
]

const headerStyle: React.CSSProperties = {
  background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.6rem 1.25rem',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  position: 'sticky', top: 0, zIndex: 50,
}
const navStyle: React.CSSProperties = { display: 'flex', gap: '1rem', alignItems: 'center' }
const navLinkStyle: React.CSSProperties = { textDecoration: 'none', fontSize: '0.8rem', padding: '0.5rem 0', transition: 'all 0.15s' }
const alertBtn: React.CSSProperties = { background: '#fbbf24', color: '#78350f', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }
const logoutBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', color: '#64748b', fontSize: '0.75rem' }
const mobileNav: React.CSSProperties = {
  display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff',
  borderTop: '1px solid #e2e8f0', padding: '0.5rem 0', justifyContent: 'space-around', zIndex: 50,
}
const mobileNavItem: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', textDecoration: 'none' }

// Add CSS for mobile bottom nav
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `@media (max-width: 640px) { [style*="display: none"][style*="position: fixed"][style*="bottom: 0"] { display: flex !important; } header nav { display: none !important; } }`
  document.head.appendChild(style)
}
