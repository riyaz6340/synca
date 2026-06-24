import { NavLink, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeToPush, isPushSubscribed } from '../utils/pushNotifications'

export default function PortalLayout() {
  const { user, logout } = useAuth()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    void isPushSubscribed().then(setPushEnabled)
  }, [])

  async function handleEnablePush() {
    setEnabling(true)
    const success = await subscribeToPush()
    setPushEnabled(success)
    setEnabling(false)
    if (success) {
      alert('🔔 Notifications enabled! You\'ll now get alerts on this device.')
    } else {
      alert('Could not enable notifications. Please allow notifications in your browser settings.')
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={headerStyle}>
        <h1 style={{ fontSize: '1.1rem', color: '#1e293b', margin: 0 }}>Avento</h1>
        <nav style={navStyle}>
          <NavLink to="/portal/persons" style={navLink}>My Children</NavLink>
          <NavLink to="/portal/notifications" style={navLink}>Notifications</NavLink>
          <NavLink to="/portal/announcements" style={navLink}>Announcements</NavLink>
          <NavLink to="/portal/leave-requests" style={navLink}>Leave Requests</NavLink>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {!pushEnabled && (
            <button onClick={() => void handleEnablePush()} disabled={enabling} style={enableBtn}>
              {enabling ? 'Enabling...' : '🔔 Enable Alerts'}
            </button>
          )}
          {pushEnabled && <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>🔔 Alerts On</span>}
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{user?.email}</span>
          <button onClick={() => void logout()} style={logoutBtn}>Logout</button>
        </div>
      </header>
      <main style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

const headerStyle: React.CSSProperties = {
  background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 1.5rem',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem',
}
const navStyle: React.CSSProperties = { display: 'flex', gap: '1.25rem', alignItems: 'center' }
const navLink: React.CSSProperties = { color: '#475569', textDecoration: 'none', fontSize: '0.9rem' }
const enableBtn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }
const logoutBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', color: '#475569', fontSize: '0.8rem' }
