import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

interface Group {
  id: string
  name: string
  description?: string | null
  member_count?: number
}

interface Teacher {
  id: string
  email: string
  role: string
}

export default function TeacherGroupsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [assignedGroupIds, setAssignedGroupIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  /**
   * Fetches teacher info, all available groups, and currently assigned groups.
   */
  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError('')

      const [teachersRes, groupsRes, assignedRes] = await Promise.all([
        apiClient.get('/teachers'),
        apiClient.get('/groups'),
        apiClient.get(`/teachers/${id}/groups`),
      ])

      // Find the specific teacher
      const teachers = teachersRes.data.teachers ?? []
      const found = teachers.find((t: Teacher) => t.id === id)
      setTeacher(found || null)

      // Set all available groups in the organization
      setAllGroups(groupsRes.data.groups ?? [])

      // Set currently assigned group IDs
      const assigned: Group[] = assignedRes.data.groups ?? []
      setAssignedGroupIds(new Set(assigned.map((g) => g.id)))
    } catch {
      setError('Failed to load group assignment data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /**
   * Toggles a group assignment on/off.
   */
  function handleGroupToggle(groupId: string) {
    setAssignedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  /**
   * Saves the group assignments to the backend.
   */
  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await apiClient.put(`/teachers/${id}/groups`, {
        group_ids: Array.from(assignedGroupIds),
      })
      setSuccess('Group assignments saved successfully')
    } catch {
      setError('Failed to save group assignments')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading group assignments...</p>
  if (!teacher) return <p style={{ color: 'red' }}>Teacher not found</p>

  const assignedCount = assignedGroupIds.size

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Group Assignments</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            {teacher.email}
          </p>
        </div>
        <button onClick={() => navigate(-1)} style={btnSecondary}>← Back</button>
      </div>

      {/* Status Messages */}
      {error && <div style={errorBanner}>{error}</div>}
      {success && <div style={successBanner}>{success}</div>}

      {/* Summary */}
      <section style={sectionStyle}>
        <h2 style={sectionTitle}>Assigned Groups</h2>
        <p style={sectionDesc}>
          Select the groups this teacher should have access to. Teachers can only manage attendance and leave requests for their assigned groups.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <span style={countBadge}>
            {assignedCount} group{assignedCount !== 1 ? 's' : ''} assigned
          </span>
        </div>

        {/* Group Checkboxes */}
        {allGroups.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            No groups available in this organization. Create groups first.
          </p>
        ) : (
          <div style={checkboxGrid}>
            {allGroups.map((group) => (
              <label key={group.id} style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={assignedGroupIds.has(group.id)}
                  onChange={() => handleGroupToggle(group.id)}
                  disabled={saving}
                  style={checkboxInput}
                />
                <div>
                  <span style={{ fontWeight: 500 }}>{group.name}</span>
                  {group.member_count !== undefined && (
                    <span style={memberCountStyle}>
                      {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                    </span>
                  )}
                  {group.description && (
                    <span style={descriptionStyle}>{group.description}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={() => void handleSave()}
          disabled={saving || allGroups.length === 0}
          style={{ ...btnPrimary, marginTop: '1.5rem' }}
        >
          {saving ? 'Saving...' : 'Save Group Assignments'}
        </button>
      </section>

      {/* Currently Assigned Summary */}
      <section style={sectionStyle}>
        <h2 style={sectionTitle}>Currently Assigned</h2>
        <p style={sectionDesc}>
          These groups are currently assigned to this teacher.
        </p>
        {assignedCount === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            No groups assigned. Select groups above and save.
          </p>
        ) : (
          <div style={chipContainer}>
            {allGroups
              .filter((g) => assignedGroupIds.has(g.id))
              .map((group) => (
                <span key={group.id} style={chipAssigned}>
                  {group.name}
                </span>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}

/* Styles matching the project's existing inline style patterns */
const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSecondary: React.CSSProperties = { background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const sectionStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }
const sectionTitle: React.CSSProperties = { fontSize: '1.1rem', margin: '0 0 0.25rem', color: '#1e293b' }
const sectionDesc: React.CSSProperties = { fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }
const checkboxGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }
const checkboxLabel: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fafbfc' }
const checkboxInput: React.CSSProperties = { width: '16px', height: '16px', cursor: 'pointer', marginTop: '2px' }
const memberCountStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }
const descriptionStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }
const countBadge: React.CSSProperties = { fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 500 }
const chipContainer: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }
const chipAssigned: React.CSSProperties = { fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '0.25rem 0.6rem', borderRadius: '4px', border: '1px solid #bbf7d0' }
const errorBanner: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }
const successBanner: React.CSSProperties = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }
