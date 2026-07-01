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
    } catch {
      setError('Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTeachers()
  }, [fetchTeachers])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Teachers</h1>
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

      {/* Teachers Table */}
      {filteredTeachers.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1rem' }}>
          {search ? 'No teachers match your search.' : 'No teachers found. Click "+ Create Teacher" to add one.'}
        </p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Role Template</th>
              <th style={thStyle}>Groups</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.map((teacher) => (
              <tr key={teacher.id}>
                <td style={tdStyle} data-label="Email">{teacher.email}</td>
                <td style={tdStyle} data-label="Role Template">
                  <span style={{
                    fontSize: '0.8rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    background: teacher.roleTemplateName ? '#dbeafe' : '#f1f5f9',
                    color: teacher.roleTemplateName ? '#1e40af' : '#64748b',
                  }}>
                    {teacher.roleTemplateName || 'None'}
                  </span>
                </td>
                <td style={tdStyle} data-label="Groups">
                  <span style={{
                    fontSize: '0.8rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    background: teacher.groupCount > 0 ? '#dcfce7' : '#f1f5f9',
                    color: teacher.groupCount > 0 ? '#166534' : '#64748b',
                  }}>
                    {teacher.groupCount} group{teacher.groupCount !== 1 ? 's' : ''}
                  </span>
                </td>
                <td style={tdStyle} data-label="Created">
                  {new Date(teacher.created_at).toLocaleDateString()}
                </td>
                <td style={tdStyle} data-label="Actions">
                  <button onClick={() => navigate(`/admin/teachers/${teacher.id}/edit`)} style={btnSmall}>Edit</button>
                  <button onClick={() => navigate(`/admin/teachers/${teacher.id}/permissions`)} style={{ ...btnSmall, marginLeft: '0.5rem' }}>Permissions</button>
                  <button onClick={() => navigate(`/admin/teachers/${teacher.id}/groups`)} style={{ ...btnSmall, marginLeft: '0.5rem' }}>Groups</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }
const btnSmall: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
const inputStyle: React.CSSProperties = { width: '100%', maxWidth: '350px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
