import React from 'react'

interface AttendanceModeSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (mode: 'sequential' | 'bulk') => void
}

export default function AttendanceModeSelector({ isOpen, onClose, onSelect }: AttendanceModeSelectorProps) {
  if (!isOpen) return null

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2 style={titleStyle}>Choose Attendance Mode</h2>
        <p style={subtitleStyle}>How would you like to mark attendance?</p>

        <div style={cardsContainerStyle}>
          {/* Sequential Mode Card */}
          <button
            style={cardStyle}
            onClick={() => onSelect('sequential')}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6'
              ;(e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'
              ;(e.currentTarget as HTMLButtonElement).style.background = '#fff'
            }}
          >
            <span style={iconStyle}>👤</span>
            <span style={cardTitleStyle}>Sequential Mode</span>
            <span style={cardDescStyle}>
              Mark students one-by-one in roll number order. Great for calling out names from the register.
            </span>
          </button>

          {/* Bulk Mode Card */}
          <button
            style={cardStyle}
            onClick={() => onSelect('bulk')}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6'
              ;(e.currentTarget as HTMLButtonElement).style.background = '#eff6ff'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'
              ;(e.currentTarget as HTMLButtonElement).style.background = '#fff'
            }}
          >
            <span style={iconStyle}>👥</span>
            <span style={cardTitleStyle}>Bulk Mode</span>
            <span style={cardDescStyle}>
              View all students at once and mark attendance in any order. Best for quick bulk marking.
            </span>
          </button>
        </div>

        <button style={closeButtonStyle} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  padding: '2rem',
  maxWidth: '480px',
  width: '90%',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
}

const titleStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: '0 0 0.25rem',
  textAlign: 'center',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
  margin: '0 0 1.5rem',
  textAlign: 'center',
}

const cardsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '1.25rem',
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '1.25rem 1rem',
  border: '2px solid #e2e8f0',
  borderRadius: '10px',
  background: '#fff',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  textAlign: 'center',
}

const iconStyle: React.CSSProperties = {
  fontSize: '1.75rem',
  marginBottom: '0.5rem',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#1e293b',
  marginBottom: '0.3rem',
}

const cardDescStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#64748b',
  lineHeight: '1.4',
}

const closeButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.6rem',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  background: '#f8fafc',
  color: '#64748b',
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'center',
}
