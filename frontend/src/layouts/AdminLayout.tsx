import { NavLink, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDisplayName } from '../utils/getDisplayName'

/**
 * Navigation items with their required permissions for Teacher users.
 * Admin/SuperAdmin users see all items. Teachers only see items
 * for which they have at least one of the required permissions.
 */
const navItems = [
  { to: '/admin/dashboard', label: '📊 Dashboard', requiredPermissions: [] as string[] },
  { to: '/admin/persons', label: '👥 Students', requiredPermissions: ['manage_students'] },
  { to: '/admin/groups', label: '🏫 Classes', requiredPermissions: ['manage_groups'] },
  { to: '/admin/attendance', label: '✅ Attendance', requiredPermissions: ['mark_attendance', 'view_attendance_reports'] },
  { to: '/admin/leave-requests', label: '📋 Leave Requests', requiredPermissions: ['approve_leave_requests', 'view_leave_requests'] },
  { to: '/admin/announcements', label: '📢 Announcements', requiredPermissions: ['create_announcements', 'publish_announcements'] },
  { to: '/admin/reports', label: '📈 Reports', requiredPermissions: ['view_attendance_reports'] },
  { to: '/admin/channels', label: '📱 Channels', requiredPermissions: [] as string[] },
  { to: '/admin/undeliverable', label: '⚠️ Undeliverable', requiredPermissions: [] as string[] },
  { to: '/admin/holidays', label: '🗓️ Holidays', requiredPermissions: ['manage_holidays'] },
  { to: '/admin/teachers', label: '👩‍🏫 Teachers', requiredPermissions: [] as string[] },
  { to: '/admin/role-templates', label: '🔑 Role Templates', requiredPermissions: [] as string[] },
  { to: '/admin/branding', label: '🎨 Branding', requiredPermissions: [] as string[] },
]

/** Items that should only ever appear for Admin users (not Teachers) */
const adminOnlyItems = ['/admin/teachers', '/admin/role-templates', '/admin/channels', '/admin/undeliverable', '/admin/branding']

export default function AdminLayout() {
  const { user, logout, teacherContext, organizationName, isLoading, logoUrl } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // Reset logo error state when logoUrl changes
  useEffect(() => {
    setLogoError(false)
  }, [logoUrl])

  const isTeacher = user?.role === 'Teacher'
  const teacherPermissions = teacherContext?.permissions ?? []

  // Filter navigation items based on user role and permissions
  const visibleNavItems = navItems.filter(item => {
    // Admin sees everything
    if (!isTeacher) return true

    // Teacher never sees admin-only items
    if (adminOnlyItems.includes(item.to)) return false

    // Dashboard is always visible for Teacher
    if (item.to === '/admin/dashboard') return true

    // Items with no required permissions (channels, undeliverable) are hidden for Teacher
    if (item.requiredPermissions.length === 0) return false

    // Teacher sees item if they have at least one of the required permissions
    return item.requiredPermissions.some(p => teacherPermissions.includes(p))
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Mobile Header */}
      <div className="admin-mobile-header" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '50px',
        background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem',
        alignItems: 'center', justifyContent: 'space-between', zIndex: 999, display: 'none',
      }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '1.2rem', cursor: 'pointer' }}>☰</button>
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>Arixx</h2>
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
          {logoUrl && !logoError ? (
            <img
              src={logoUrl}
              alt={organizationName ?? 'Organization logo'}
              style={{ maxWidth: 140, maxHeight: 48, objectFit: 'contain', display: 'block' }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Arixx</h2>
          )}
          {isLoading ? (
            <div style={{ margin: '0.25rem 0 0', height: '1rem', width: '70%', background: '#1e293b', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ) : (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>{getDisplayName(organizationName)}</p>
          )}
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>{isTeacher ? 'Teacher Panel' : 'Admin Panel'}</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 0.5rem', flex: 1, overflowY: 'auto' }}>
          {visibleNavItems.map(item => (
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
