import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

interface Teacher {
  id: string
  email: string
  role: string
  organization_id: string
  created_at: string
  updated_at: string
}

interface TeacherDisplay {
  id: string
  email: string
  roleTemplateName: string | null
  groupCount: number
  created_at: string
}

export default function TeacherListPage() {
  const [teachers, setTeachers] = useState<TeacherDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true)
      const teachersRes = await apiClient.get('/teachers')
      const teacherList: Teacher[] = teachersRes.data.teachers ?? []

      // For each teacher, fetch their assigned groups count
      const enriched: TeacherDisplay[] = await Promise.all(
        teacherList.map(async (teacher) => {
          let groupCount = 0
          let roleTemplateName: string | null = null

          try {
            const groupsRes = await apiClient.get(`/teachers/${teacher.id}/groups`)
            groupCount = (groupsRes.data.groups ?? []).length
          } catch {
            // Ignore - teacher might have no groups
          }

          return {
            id: teacher.id,
            email: teacher.email,
            roleTemplateName,
            groupCount,
            created_at: teacher.created_at,
          }
        })
      )

      setTeachers(enriched)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 404) {
        setError('Teachers feature requires backend update. Please redeploy to Render.')
      } else {
        setError('Failed to load teachers')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTeachers()
  }, [fetchTeachers])

  // Scroll to top when page loads (fixes mobile scroll position after navigation)
  useEffect(() => {
    window.scrollTo(0, 0)
    const mainEl = document.querySelector('.admin-main')
    if (mainEl) mainEl.scrollTop = 0
  }, [])

  const filteredTeachers = teachers.filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.email.toLowerCase().includes(q) ||
      (t.roleTemplateName && t.roleTemplateName.toLowerCase().includes(q))
    )
  })

  if (loading) return <p>Loading teachers...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>👩‍🏫 Teachers</h1>
        <button onClick={() => navigate('/admin/teachers/create')} style={btnPrimary}>+ Create Teacher</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          style={inputStyle}
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Teachers Cards (mobile-friendly) */}
      {filteredTeachers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👩‍🏫</div>
          <h2 style={{ fontSize: '1.1rem', color: '#475569', margin: '0 0 0.5rem' }}>
            {search ? 'No teachers match your search' : 'No Teachers Yet'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            {search ? 'Try a different search term.' : 'Click "+ Create Teacher" to add your first teacher.'}
          </p>
          {!search && <button onClick={() => navigate('/admin/teachers/create')} style={btnPrimary}>+ Create Teacher</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredTeachers.map((teacher) => (
            <div key={teacher.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{teacher.email}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '10px',
                      background: teacher.roleTemplateName ? '#dbeafe' : '#f1f5f9',
                      color: teacher.roleTemplateName ? '#1e40af' : '#64748b',
                    }}>
                      {teacher.roleTemplateName || 'No template'}
                    </span>
                    <span style={{
                      fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '10px',
                      background: teacher.groupCount > 0 ? '#dcfce7' : '#f1f5f9',
                      color: teacher.groupCount > 0 ? '#166534' : '#64748b',
                    }}>
                      {teacher.groupCount} group{teacher.groupCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  {new Date(teacher.created_at).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => navigate(`/admin/teachers/${teacher.id}/edit`)} style={actionBtn}>✏️ Edit</button>
                <button onClick={() => navigate(`/admin/teachers/${teacher.id}/permissions`)} style={{ ...actionBtn, color: '#7c3aed' }}>🔑 Permissions</button>
                <button onClick={() => navigate(`/admin/teachers/${teacher.id}/groups`)} style={{ ...actionBtn, color: '#2563eb' }}>🏫 Groups</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile floating create button - always visible */}
      <div style={{ position: 'sticky', bottom: '0', padding: '0.75rem 0', background: 'linear-gradient(transparent, #f8fafc 30%)', marginTop: '1rem' }}>
        <button onClick={() => navigate('/admin/teachers/create')} style={{ ...btnPrimary, width: '100%', padding: '0.75rem' }}>+ Create Teacher</button>
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }
const inputStyle: React.CSSProperties = { width: '100%', maxWidth: '350px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem' }
const actionBtn: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.3rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', color: '#475569' }
