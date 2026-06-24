import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  sent_at: string | null
  created_at: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const typeConfig: Record<string, { icon: string; label: string; bg: string; border: string; color: string; iconBg: string }> = {
  absence: { icon: '🚫', label: 'Absent', bg: '#fef2f2', border: '#fecaca', color: '#991b1b', iconBg: '#fee2e2' },
  late: { icon: '⏰', label: 'Late', bg: '#fffbeb', border: '#fde68a', color: '#92400e', iconBg: '#fef3c7' },
  leave_approved: { icon: '✅', label: 'Leave Approved', bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', iconBg: '#dcfce7' },
  leave_rejected: { icon: '❌', label: 'Leave Rejected', bg: '#fef2f2', border: '#fecaca', color: '#991b1b', iconBg: '#fee2e2' },
  announcement: { icon: '📢', label: 'Announcement', bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', iconBg: '#dbeafe' },
}

const defaultTypeConfig = { icon: '🔔', label: 'Notification', bg: '#f8fafc', border: '#e2e8f0', color: '#475569', iconBg: '#f1f5f9' }

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('avento_read_notifications')
    return stored ? new Set(JSON.parse(stored)) : new Set()
  })

  const fetchNotifications = useCallback(async (page: number) => {
    try {
      setLoading(true)
      const res = await apiClient.get('/portal/notifications', { params: { page, limit: 20 } })
      setNotifications(res.data.data ?? [])
      setPagination(res.data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchNotifications(1) }, [fetchNotifications])

  function markAsRead(id: string) {
    const newReadIds = new Set(readIds)
    newReadIds.add(id)
    setReadIds(newReadIds)
    localStorage.setItem('avento_read_notifications', JSON.stringify([...newReadIds]))
  }

  function markAllAsRead() {
    const allIds = new Set(notifications.map(n => n.id))
    const merged = new Set([...readIds, ...allIds])
    setReadIds(merged)
    localStorage.setItem('avento_read_notifications', JSON.stringify([...merged]))
  }

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length

  if (loading && notifications.length === 0) return <p>Loading notifications...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          Notifications
          {unreadCount > 0 && <span style={unreadBadge}>{unreadCount} new</span>}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} style={markAllBtn}>Mark all as read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔔</p>
          <p>No notifications yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map((n) => {
            const config = typeConfig[n.type] || defaultTypeConfig
            const isRead = readIds.has(n.id)

            return (
              <div
                key={n.id}
                onClick={() => markAsRead(n.id)}
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                  borderLeft: `4px solid ${config.color}`,
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  opacity: isRead ? 0.7 : 1,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  {/* Icon */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: config.iconBg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0,
                  }}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ ...typeBadgeStyle, background: config.iconBg, color: config.color }}>
                          {config.label}
                        </span>
                        {!isRead && <span style={newDot}></span>}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {formatDate(n.sent_at || n.created_at)}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '0.9rem', margin: '0.2rem 0', color: config.color, fontWeight: 600 }}>{n.title}</h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.4' }}>{n.body}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button onClick={() => void fetchNotifications(pagination.page - 1)} disabled={pagination.page <= 1} style={{ ...paginationBtn, opacity: pagination.page <= 1 ? 0.5 : 1 }}>← Previous</button>
          <span style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#475569' }}>Page {pagination.page} of {pagination.totalPages}</span>
          <button onClick={() => void fetchNotifications(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} style={{ ...paginationBtn, opacity: pagination.page >= pagination.totalPages ? 0.5 : 1 }}>Next →</button>
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dateStr }
}

const unreadBadge: React.CSSProperties = { background: '#dc2626', color: '#fff', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', marginLeft: '0.5rem', fontWeight: 600 }
const markAllBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.35rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }
const typeBadgeStyle: React.CSSProperties = { padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }
const newDot: React.CSSProperties = { width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }
const paginationBtn: React.CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' }
