import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'

interface LeaveRequest {
  id: string
  person_id: string
  person_name?: string
  person_metadata?: { roll_number?: string; [key: string]: unknown }
  group_name?: string
  group_id?: string
  requested_by: string
  start_date: string
  end_date: string
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
  review_comment?: string
  created_at: string
}

export default function LeaveRequestsPage() {
  const { user, teacherContext } = useAuth()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [viewingRequest, setViewingRequest] = useState<LeaveRequest | null>(null)
  const [studentDetail, setStudentDetail] = useState<Record<string, unknown> | null>(null)

  const isTeacher = user?.role === 'Teacher'
  const assignedGroupIds = teacherContext?.assignedGroups.map(g => g.id) ?? []
  const assignedGroupIdsKey = assignedGroupIds.join(',')

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/leave-requests')
      let data: LeaveRequest[] = res.data.data ?? []
      // Teacher: filter to only show leave requests from their assigned groups
      if (isTeacher && assignedGroupIds.length > 0) {
        data = data.filter(r => r.group_id && assignedGroupIds.includes(r.group_id))
      } else if (isTeacher && assignedGroupIds.length === 0) {
        data = []
      }
      setRequests(data)
    } catch {
      setError('Failed to load leave requests')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, assignedGroupIdsKey])

  useEffect(() => {
    void fetchRequests()
  }, [fetchRequests])

  async function openRequestDetail(request: LeaveRequest) {
    setViewingRequest(request)
    try {
      const res = await apiClient.get(`/persons/${request.person_id}`)
      setStudentDetail(res.data.person ?? null)
    } catch {
      setStudentDetail(null)
    }
  }

  async function handleApprove(id: string) {
    try {
      await apiClient.put(`/leave-requests/${id}/approve`)
      void fetchRequests()
    } catch {
      alert('Failed to approve request')
    }
  }

  async function handleReject() {
    if (!rejectingId) return
    try {
      await apiClient.put(`/leave-requests/${rejectingId}/reject`, { review_comment: rejectReason })
      setRejectingId(null)
      setRejectReason('')
      void fetchRequests()
    } catch {
      alert('Failed to reject request')
    }
  }

  if (loading) return <p>Loading leave requests...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  // Empty state for Teachers with no assigned groups
  if (isTeacher && assignedGroupIds.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Leave Requests</h1>
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <h2 style={{ fontSize: '1.1rem', color: '#475569', margin: '0 0 0.5rem' }}>No Groups Assigned</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
            You haven't been assigned to any classes yet. Please contact your Admin to get group access for leave request management.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Leave Requests</h1>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Student</th>
            <th style={thStyle}>Class</th>
            <th style={thStyle}>From</th>
            <th style={thStyle}>To</th>
            <th style={thStyle}>Reason</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const rollNo = r.person_metadata?.roll_number
            const displayName = r.person_name || r.person_id.substring(0, 8)
            return (
              <tr key={r.id}>
                <td style={tdStyle} data-label="Student">
                  <strong>{displayName}</strong>
                  {rollNo && <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Roll: {rollNo}</span>}
                </td>
                <td style={tdStyle} data-label="Class">{r.group_name || '—'}</td>
                <td style={tdStyle} data-label="From">{formatDate(r.start_date)}</td>
                <td style={tdStyle} data-label="To">{formatDate(r.end_date)}</td>
                <td style={tdStyle} data-label="Reason">{r.reason}</td>
                <td style={tdStyle} data-label="Status">
                  <span style={{ color: statusColor(r.status) }}>{r.status}</span>
                </td>
                <td style={tdStyle} data-label="Actions">
                  <button onClick={() => void openRequestDetail(r)} style={{ ...btnSmall, color: '#2563eb' }}>View</button>
                  {r.status === 'Pending' && (
                    <>
                      <button onClick={() => void handleApprove(r.id)} style={{ ...btnSmall, color: '#16a34a', marginLeft: '0.5rem' }}>Approve</button>
                      <button onClick={() => { setRejectingId(r.id); setRejectReason('') }} style={{ ...btnSmall, color: '#dc2626', marginLeft: '0.5rem' }}>Reject</button>
                    </>
                  )}
                  {r.review_comment && <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>({r.review_comment})</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {requests.length === 0 && <p style={{ color: '#64748b', marginTop: '1rem' }}>No leave requests found.</p>}

      {/* Reject Modal */}
      {rejectingId && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0 }}>Reject Leave Request</h2>
            <label style={labelStyle}>Reason for rejection</label>
            <textarea
              style={{ ...inputStyle, minHeight: '80px' }}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => void handleReject()} style={{ ...btnPrimary, background: '#dc2626' }}>Reject</button>
              <button onClick={() => setRejectingId(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Popup */}
      {viewingRequest && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: '550px' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Leave Request Details</h2>

            {/* Leave Request Info */}
            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div><span style={{ color: '#64748b' }}>From:</span> <strong>{formatDate(viewingRequest.start_date)}</strong></div>
                <div><span style={{ color: '#64748b' }}>To:</span> <strong>{formatDate(viewingRequest.end_date)}</strong></div>
                <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#64748b' }}>Reason:</span> <strong>{viewingRequest.reason}</strong></div>
                <div><span style={{ color: '#64748b' }}>Status:</span> <span style={{ color: statusColor(viewingRequest.status), fontWeight: 600 }}>{viewingRequest.status}</span></div>
              </div>
            </div>

            {/* Student Info */}
            <h3 style={{ fontSize: '0.9rem', color: '#475569', margin: '0 0 0.5rem' }}>Student Information</h3>
            {studentDetail ? (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <div><span style={{ color: '#64748b' }}>Name:</span> <strong>{(studentDetail as { name?: string }).name}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Roll:</span> <strong>{(studentDetail as { roll_number?: string }).roll_number || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Admission:</span> <strong>{(studentDetail as { admission_number?: string }).admission_number || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Class:</span> <strong>{viewingRequest.group_name || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Father:</span> <strong>{(studentDetail as { father_name?: string }).father_name || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Mother:</span> <strong>{(studentDetail as { mother_name?: string }).mother_name || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Mobile:</span> <strong>{(studentDetail as { parent_mobile?: string }).parent_mobile || '—'}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Guardian:</span> <strong>{(studentDetail as { guardian_name?: string }).guardian_name || '—'}</strong></div>
                </div>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading student info...</p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              {viewingRequest.status === 'Pending' && (
                <>
                  <button onClick={() => { void handleApprove(viewingRequest.id); setViewingRequest(null) }} style={{ ...btnPrimary, background: '#16a34a' }}>✓ Approve</button>
                  <button onClick={() => { setRejectingId(viewingRequest.id); setRejectReason(''); setViewingRequest(null) }} style={{ ...btnPrimary, background: '#dc2626' }}>✗ Reject</button>
                </>
              )}
              <button onClick={() => { setViewingRequest(null); setStudentDetail(null) }} style={btnSecondary}>Close</button>
            </div>
          </div>
        </div>
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

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSecondary: React.CSSProperties = { background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSmall: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '450px' }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box' }
