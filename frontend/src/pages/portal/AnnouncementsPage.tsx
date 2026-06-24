import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Announcement {
  id: string
  title: string
  body: string
  target_type: string
  published_at: string
  created_at: string
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('avento_read_announcements')
    return stored ? new Set(JSON.parse(stored)) : new Set()
  })

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/portal/announcements')
      setAnnouncements(res.data.announcements ?? [])
    } catch {
      setError('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAnnouncements() }, [fetchAnnouncements])

  function markAsRead(id: string) {
    const newReadIds = new Set(readIds)
    newReadIds.add(id)
    setReadIds(newReadIds)
    localStorage.setItem('avento_read_announcements', JSON.stringify([...newReadIds]))
  }

  function markAllAsRead() {
    const allIds = new Set(announcements.map(a => a.id))
    const merged = new Set([...readIds, ...allIds])
    setReadIds(merged)
    localStorage.setItem('avento_read_announcements', JSON.stringify([...merged]))
  }

  const unreadCount = announcements.filter(a => !readIds.has(a.id)).length

  if (loading) return <p>Loading announcements...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          Announcements
          {unreadCount > 0 && <span style={unreadBadge}>{unreadCount} new</span>}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} style={markAllBtn}>Mark all as read</button>
        )}
      </div>

      {announcements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📢</p>
          <p>No announcements yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {announcements.map((a) => {
            const isRead = readIds.has(a.id)
            return (
              <article
                key={a.id}
                style={{
                  ...cardStyle,
                  opacity: isRead ? 0.7 : 1,
                  borderLeft: isRead ? '4px solid #e2e8f0' : '4px solid #3b82f6',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>📢</span>
                    <h2 style={{ fontSize: '1rem', margin: 0, color: '#1e293b' }}>{a.title}</h2>
                    {!isRead && <span style={newDot}></span>}
                  </div>
                  <time style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {formatDate(a.published_at)}
                  </time>
                </div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {a.body}
                </p>
                {!isRead && (
                  <button onClick={() => markAsRead(a.id)} style={readBtn}>
                    ✓ Mark as read
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }
const unreadBadge: React.CSSProperties = { background: '#3b82f6', color: '#fff', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', marginLeft: '0.5rem', fontWeight: 600 }
const markAllBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.35rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }
const newDot: React.CSSProperties = { width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }
const readBtn: React.CSSProperties = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }
