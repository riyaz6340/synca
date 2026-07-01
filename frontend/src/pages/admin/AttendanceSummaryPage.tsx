import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import apiClient from '../../api/client'

interface Member {
  person_id: string
  name: string
  roll_number: number | null
  photo_url: string | null
  status: 'Present' | 'Absent' | 'Late' | null
}

export default function AttendanceSummaryPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Receive members from navigation state (passed from SequentialAttendancePage)
  const locationState = location.state as { members?: Member[] } | null
  const [members] = useState<Member[]>(locationState?.members ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // If no members data, redirect back
  if (members.length === 0 && !submitSuccess) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No attendance data available.</p>
        <button onClick={() => navigate('/admin/attendance')} style={backBtnStyle}>
          ← Back to Attendance
        </button>
      </div>
    )
  }

  const presentCount = members.filter(m => m.status === 'Present').length
  const absentCount = members.filter(m => m.status === 'Absent').length
  const lateCount = members.filter(m => m.status === 'Late').length
  const totalCount = members.length

  async function handleSubmit() {
    if (!groupId) return
    setSubmitting(true)
    setSubmitError('')

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    const records = members
      .filter(m => m.status !== null)
      .map(m => ({
        person_id: m.person_id,
        presence_status: m.status,
      }))

    try {
      await apiClient.post('/attendance/bulk', {
        group_id: groupId,
        date: today,
        records,
      })
      setSubmitSuccess(true)
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to submit attendance. Please try again.'
      setSubmitError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // Success state
  if (submitSuccess) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ fontSize: '1.2rem', color: '#1e293b', margin: '0 0 0.5rem' }}>
          Attendance Submitted Successfully
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 2rem' }}>
          {totalCount} records have been saved for today.
        </p>
        <button onClick={() => navigate('/admin/attendance')} style={primaryBtnStyle}>
          ← Back to Attendance
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
        <h2 style={{ fontSize: '1.2rem', color: '#1e293b', margin: '0 0 0.25rem' }}>
          Attendance Summary
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
          {totalCount} students total
        </p>
      </div>

      {/* Summary counts */}
      <div style={summaryCardStyle}>
        <div style={summaryRowStyle}>
          <span style={{ ...statusDotStyle, background: '#22c55e' }}></span>
          <span style={{ flex: 1, fontSize: '0.9rem', color: '#374151' }}>Present</span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#16a34a' }}>{presentCount}</span>
        </div>
        <div style={summaryRowStyle}>
          <span style={{ ...statusDotStyle, background: '#ef4444' }}></span>
          <span style={{ flex: 1, fontSize: '0.9rem', color: '#374151' }}>Absent</span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#dc2626' }}>{absentCount}</span>
        </div>
        <div style={{ ...summaryRowStyle, borderBottom: 'none' }}>
          <span style={{ ...statusDotStyle, background: '#f59e0b' }}></span>
          <span style={{ flex: 1, fontSize: '0.9rem', color: '#374151' }}>Late</span>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#d97706' }}>{lateCount}</span>
        </div>
      </div>

      {/* Student list (optional detailed view) */}
      <details style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 500, marginBottom: '0.5rem' }}>
          View all students ({totalCount})
        </summary>
        <div style={studentListStyle}>
          {members.map((m) => (
            <div key={m.person_id} style={studentListItemStyle}>
              <span style={{ flex: 1, fontSize: '0.8rem', color: '#374151' }}>
                {m.roll_number ? `${m.roll_number}. ` : ''}{m.name}
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                background: m.status === 'Present' ? '#dcfce7' : m.status === 'Absent' ? '#fef2f2' : '#fef9c3',
                color: m.status === 'Present' ? '#16a34a' : m.status === 'Absent' ? '#dc2626' : '#d97706',
              }}>
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </details>

      {/* Error message */}
      {submitError && (
        <div style={errorBannerStyle}>
          <span style={{ fontSize: '0.85rem' }}>⚠️ {submitError}</span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => navigate(-1)}
          disabled={submitting}
          style={{
            ...secondaryBtnStyle,
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => void handleSubmit()}
          disabled={submitting}
          style={{
            ...primaryBtnStyle,
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting...' : submitError ? 'Retry Submission' : 'Confirm & Submit'}
        </button>
      </div>
    </div>
  )
}

// Styles
const backBtnStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '0.5rem 1.25rem',
  background: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
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
  padding: '0.75rem 0',
  borderBottom: '1px solid #e2e8f0',
}

const statusDotStyle: React.CSSProperties = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
}

const studentListStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  maxHeight: '250px',
  overflowY: 'auto',
}

const studentListItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid #f1f5f9',
}

const errorBannerStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  color: '#dc2626',
}

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.75rem 1rem',
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
  padding: '0.75rem 1rem',
  background: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 500,
}
