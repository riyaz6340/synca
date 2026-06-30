import { NavLink } from 'react-router-dom'

/**
 * Navigation bar linking the five views with ≥44×44px touch targets.
 * Requirements: 8.7
 */

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/leave', label: 'Leave' },
  { to: '/change-password', label: '🔒' },
] as const

export default function AppNav() {
  return (
    <nav aria-label="Main navigation" style={{ width: '100%' }}>
      <ul
        style={{
          display: 'flex',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          justifyContent: 'space-around',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        {navItems.map(({ to, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                minHeight: '44px',
                padding: '0.75rem 0.5rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#2563eb' : '#475569',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
              })}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
