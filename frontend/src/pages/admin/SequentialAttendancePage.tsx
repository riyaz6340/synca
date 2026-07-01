import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

interface Member {
  person_id: string
  name: string
  roll_number: number | null
  photo_url: string | null
  status: 'Present' | 'Absent' | 'Late' | null
}

export default function SequentialAttendancePage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const [members, setMembers] = useState<Member[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEmpty, setIsEmpty] = useState(false)
  const [allMarked, setAllMarked] = useState(false)

  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!groupId) return
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.get(`/attendance/group/${groupId}/members`)
      const data: Array<{ person_id: string; name: string; roll_number: number | null; photo_url: string | null }> = res.data.members ?? []
      if (data.length === 0) {
        setIsEmpty(true)
        setMembers([])
      } else {
        setIsEmpty(false)
        setMembers(data.map(m => ({ ...m, status: null })))
      }
    } catch {
      setError('Failed to load group members')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
    }
  }, [])

  // Check if all students have been marked
  useEffect(() => {
    if (members.length > 0 && members.every(m => m.status !== null)) {
      setAllMarked(true)
    }
  }, [members])

  function markStatus(status: 'Present' | 'Absent' | 'Late') {
    setMembers(prev => {
      const updated = [...prev]
      updated[currentIndex] = { ...updated[currentIndex], status }
      return updated
    })

    // Auto-advance to next student after 300ms
    if (currentIndex < members.length - 1) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
      autoAdvanceTimer.current = setTimeout(() => {
        setCurrentIndex(prev => prev + 1)
      }, 300)
    }
  }

  function goToPrevious() {
    if (currentIndex > 0) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
      setCurrentIndex(prev => prev - 1)
    }
  }

  function goToNext() {
    if (currentIndex < members.length - 1) {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current)
      setCurrentIndex(prev => prev + 1)
    }
  }

  function handleViewSummary() {
    // Navigate to summary with the attendance data stored in state
    navigate(`/admin/attendance/sequential/${groupId}/summary`, {
      state: { members }
    })
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading students...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>{error}</p>
        <button onClick={() => void fetchMembers()} style={retryBtnStyle}>Retry</button>
      </div>
    )
  }

  // Empty group state
  if (isEmpty) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
        <h2 style={{ fontSize: '1.1rem', color: '#475569', margin: '0 0 0.5rem' }}>No students available</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.5rem' }}>
          This group has no members. Add students to the group before marking attendance.
        </p>
        <button onClick={() => navigate('/admin/attendance')} style={backBtnStyle}>
          ← Back to Attendance
        </button>
      </div>
    )
  }

  // All marked — show summary prompt
  if (allMarked) {
    const presentCount = members.filter(m => m.status === 'Present').length
    const absentCount = members.filter(m => m.status === 'Absent').length
    const lateCount = members.filter(m => m.status === 'Late').length

    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
          <h2 style={{ fontSize: '1.2rem', color: '#1e293b', margin: '0 0 0.25rem' }}>All Students Marked</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
            {members.length} students have been marked
          </p>
        </div>

        <div style={summaryCardStyle}>
          <div style={summaryRowStyle}>
            <span style={{ ...statusDotStyle, background: '#22c55e' }}></span>
            <span style={{ flex: 1, fontSize: '0.9rem', color: '#374151' }}>Present</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#16a34a' }}>{presentCount}</span>
          </div>
          <div style={summaryRowStyle}>
            <span style={{ ...statusDotStyle, background: '#ef4444' }}></span>
            <span style={{ flex: 1, fontSize: '0.9rem', color: '#374151' }}>Absent</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#dc2626' }}>{absentCount}</span>
          </div>
          <div style={{ ...summaryRowStyle, borderBottom: 'none' }}>
            <span style={{ ...statusDotStyle, background: '#f59e0b' }}></span>
            <span style={{ flex: 1, fontSize: '0.9rem', color: '#374151' }}>Late</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d97706' }}>{lateCount}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={() => { setAllMarked(false); setCurrentIndex(0) }} style={secondaryBtnStyle}>
            ← Review
          </button>
          <button onClick={handleViewSummary} style={primaryBtnStyle}>
            Confirm & Submit →
          </button>
        </div>
      </div>
    )
  }

  // Main sequential attendance view
  const current = members[currentIndex]
  const markedCount = members.filter(m => m.status !== null).length

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      {/* Header with progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button onClick={() => navigate('/admin/attendance')} style={backLinkStyle}>
          ← Back
        </button>
        <span style={progressTextStyle}>
          {currentIndex + 1} of {members.length}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {markedCount} marked
        </span>
      </div>

      {/* Progress bar */}
      <div style={progressBarContainerStyle}>
        <div style={{ ...progressBarFillStyle, width: `${((currentIndex + 1) / members.length) * 100}%` }}></div>
      </div>

      {/* Student card */}
      <div style={studentCardStyle}>
        {/* Photo placeholder */}
        <div style={photoStyle}>
          {current.photo_url ? (
            <img src={current.photo_url} alt={current.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '2.5rem' }}>👤</span>
          )}
        </div>

        {/* Student info */}
        <h2 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#1e293b', margin: '0.75rem 0 0.25rem', textAlign: 'center' }}>
          {current.name}
        </h2>
        {current.roll_number && (
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.5rem', textAlign: 'center' }}>
            Roll No: {current.roll_number}
          </p>
        )}

        {/* Current status indicator */}
        {current.status && (
          <div style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            background: current.status === 'Present' ? '#dcfce7' : current.status === 'Absent' ? '#fef2f2' : '#fef9c3',
            color: current.status === 'Present' ? '#16a34a' : current.status === 'Absent' ? '#dc2626' : '#d97706',
          }}>
            {current.status === 'Present' ? '✓ Present' : current.status === 'Absent' ? '✗ Absent' : '⏱ Late'}
          </div>
        )}
      </div>

      {/* Status buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => markStatus('Present')}
          style={{
            ...statusBtnBase,
            background: current.status === 'Present' ? '#16a34a' : '#dcfce7',
            color: current.status === 'Present' ? '#fff' : '#16a34a',
            border: `2px solid ${current.status === 'Present' ? '#16a34a' : '#86efac'}`,
          }}
        >
          ✓ Present
        </button>
        <button
          onClick={() => markStatus('Absent')}
          style={{
            ...statusBtnBase,
            background: current.status === 'Absent' ? '#dc2626' : '#fef2f2',
            color: current.status === 'Absent' ? '#fff' : '#dc2626',
            border: `2px solid ${current.status === 'Absent' ? '#dc2626' : '#fca5a5'}`,
          }}
        >
          ✗ Absent
        </button>
        <button
          onClick={() => markStatus('Late')}
          style={{
            ...statusBtnBase,
            background: current.status === 'Late' ? '#d97706' : '#fef9c3',
            color: current.status === 'Late' ? '#fff' : '#d97706',
            border: `2px solid ${current.status === 'Late' ? '#d97706' : '#fde047'}`,
          }}
        >
          ⏱ Late
        </button>
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          style={{
            ...navBtnStyle,
            opacity: currentIndex === 0 ? 0.4 : 1,
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          ← Previous
        </button>
        <button
          onClick={goToNext}
          disabled={currentIndex === members.length - 1}
          style={{
            ...navBtnStyle,
            opacity: currentIndex === members.length - 1 ? 0.4 : 1,
            cursor: currentIndex === members.length - 1 ? 'not-allowed' : 'pointer',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

// Styles
const retryBtnStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '0.5rem 1.25rem',
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
}

const backBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  background: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
}

const backLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#3b82f6',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontWeight: 500,
  padding: 0,
}

const progressTextStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#1e293b',
}

const progressBarContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '6px',
  background: '#e2e8f0',
  borderRadius: '3px',
  marginBottom: '1.5rem',
  overflow: 'hidden',
}

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  background: '#3b82f6',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
}

const studentCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '2rem 1.5rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: '1.5rem',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
}

const photoStyle: React.CSSProperties = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  background: '#f1f5f9',
  border: '3px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}

const statusBtnBase: React.CSSProperties = {
  flex: 1,
  padding: '0.85rem 0.5rem',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
  textAlign: 'center',
  transition: 'background 0.15s, color 0.15s',
}

const navBtnStyle: React.CSSProperties = {
  padding: '0.6rem 1.25rem',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#475569',
}

const summaryCardStyle: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '0.75rem 1rem',
}

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.6rem 0',
  borderBottom: '1px solid #e2e8f0',
}

const statusDotStyle: React.CSSProperties = {
  width: '10px',
  height: '10px',
  borderRadius: '50%',
}

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.7rem 1rem',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 600,
}

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.7rem 1rem',
  background: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 500,
}
