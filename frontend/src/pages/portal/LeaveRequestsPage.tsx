import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Person {
  id: string
  name: string
  relationship: string
}

interface LeaveRequest {
  id: string
  person_id: string
  start_date: string
  end_date: string
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
  review_comment?: string
  created_at: string
}

export default function LeaveRequestsPage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [personId, setPersonId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [personsRes, requestsRes] = await Promise.all([
        apiClient.get('/portal/persons'),
        apiClient.get('/leave-requests'),
      ])
      setPersons(personsRes.data.persons ?? [])
      const reqData = requestsRes.data
      setRequests(Array.isArray(reqData) ? reqData : reqData.data ?? [])
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    if (!personId || !startDate || !endDate || !reason.trim()) {
      setSubmitError('All fields are required')
      return
    }

    if (endDate < startDate) {
      setSubmitError('End date must be on or after start date')
      return
    }

    try {
      setSubmitting(true)
      await apiClient.post('/leave-requests', {
        person_id: personId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
      })
      // Reset form and refresh
      setPersonId('')
      setStartDate('')
      setEndDate('')
      setReason('')
      setShowForm(false)
      void fetchData()
    } catch {
      setSubmitError('Failed to submit leave request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Leave Requests</h1>
        <button onClick={() => setShowForm(!showForm)} style={btnPrimary}>
          {showForm ? 'Cancel' : '+ New Request'}
        </button>
      </div>

      {/* Leave Request Form */}
      {showForm && (
        <div style={formCard}>
          <h2 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>Submit Leave Request</h2>

          {submitError && (
            <div role="alert" style={alertStyle}>{submitError}</div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="person-select" style={labelStyle}>Person</label>
              <select
                id="person-select"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                style={inputStyle}
                required
              >
                <option value="">Select a person...</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.relationship})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label htmlFor="leave-start" style={labelStyle}>Start Date</label>
                <input
                  id="leave-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label htmlFor="leave-end" style={labelStyle}>End Date</label>
                <input
                  id="leave-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="leave-reason" style={labelStyle}>Reason</label>
              <textarea
                id="leave-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="Enter reason for leave..."
                required
              />
            </div>

            <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      {/* Leave Requests Table */}
      {requests.length === 0 ? (
        <p style={{ color: '#64748b' }}>No leave requests found.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Person</th>
              <th style={thStyle}>Start Date</th>
              <th style={thStyle}>End Date</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const personName = persons.find((p) => p.id === r.person_id)?.name ?? r.person_id
              return (
                <tr key={r.id}>
                  <td style={tdStyle}>{personName}</td>
                  <td style={tdStyle}>{r.start_date}</td>
                  <td style={tdStyle}>{r.end_date}</td>
                  <td style={tdStyle}>{r.reason}</td>
                  <td style={tdStyle}>
                    <span style={{ color: statusColor(r.status) }}>{r.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {r.review_comment && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.review_comment}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function statusColor(status: string): string {
  switch (status) {
    case 'Approved': return '#16a34a'
    case 'Rejected': return '#dc2626'
    default: return '#d97706'
  }
}

const btnPrimary: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.9rem',
}

const formCard: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1.25rem',
  marginBottom: '1.5rem',
}

const alertStyle: React.CSSProperties = {
  background: '#fef2f2',
  color: '#dc2626',
  padding: '0.6rem',
  borderRadius: '4px',
  marginBottom: '0.75rem',
  fontSize: '0.85rem',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  fontSize: '0.85rem',
  color: '#475569',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
}

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
