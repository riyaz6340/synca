import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface UndeliverableNotification {
  id: string
  stakeholder_id: string
  stakeholder_name?: string
  type: string
  title: string
  body: string
  channel_used: string
  delivery_status: string
  created_at: string
}

export default function UndeliverablePage() {
  const [notifications, setNotifications] = useState<UndeliverableNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/notifications/undeliverable')
      setNotifications(res.data.data ?? [])
    } catch {
      setError('Failed to load undeliverable notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  if (loading) return <p>Loading undeliverable notifications...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Undeliverable Notifications</h1>

      {notifications.length === 0 ? (
        <p style={{ color: '#64748b' }}>No undeliverable notifications. All messages have been delivered successfully.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Stakeholder</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Channel</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id}>
                <td style={tdStyle}>{n.stakeholder_name ?? n.stakeholder_id}</td>
                <td style={tdStyle}>{n.type}</td>
                <td style={tdStyle}>{n.title}</td>
                <td style={tdStyle}>{n.channel_used || '—'}</td>
                <td style={tdStyle}>
                  <span style={{ color: '#dc2626' }}>{n.delivery_status}</span>
                </td>
                <td style={tdStyle}>{new Date(n.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
