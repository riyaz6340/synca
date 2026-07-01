import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Group {
  id: string
  name: string
  description: string
  member_count?: number
  members?: Person[]
  created_at: string
}

interface Person {
  id: string
  name: string
  roll_number?: string
  admission_number?: string
  father_name?: string
}

interface GroupForm {
  name: string
  description: string
}

const emptyForm: GroupForm = { name: '', description: '' }

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GroupForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [managingGroup, setManagingGroup] = useState<Group | null>(null)
  const [groupMembers, setGroupMembers] = useState<Person[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberListSearch, setMemberListSearch] = useState('')
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  // Subjects
  const [subjectsGroup, setSubjectsGroup] = useState<Group | null>(null)
  const [subjects, setSubjects] = useState<{ id: string; name: string; teacher_name?: string; period_number?: number }[]>([])
  const [newSubject, setNewSubject] = useState({ name: '', teacher_name: '', period_number: '' })

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/groups')
      setGroups(res.data.groups ?? [])
    } catch {
      setError('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPersons = useCallback(async () => {
    try {
      const res = await apiClient.get('/persons')
      setPersons(res.data.data ?? [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void fetchGroups()
    void fetchPersons()
  }, [fetchGroups, fetchPersons])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(group: Group) {
    setEditingId(group.id)
    setForm({ name: group.name, description: group.description })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editingId) {
        await apiClient.put(`/groups/${editingId}`, form)
      } else {
        await apiClient.post('/groups', form)
      }
      setShowModal(false)
      void fetchGroups()
    } catch {
      alert('Failed to save group')
    } finally {
      setSaving(false)
    }
  }

  async function openManageMembers(group: Group) {
    setManagingGroup(group)
    try {
      const res = await apiClient.get(`/groups/${group.id}`)
      setGroupMembers(res.data.group?.members ?? [])
    } catch {
      setGroupMembers([])
    }
  }

  async function addMember() {
    if (!managingGroup || !selectedPersonId) return
    try {
      await apiClient.post(`/groups/${managingGroup.id}/members`, { person_ids: [selectedPersonId] })
      setSelectedPersonId('')
      void openManageMembers(managingGroup)
      void fetchGroups()
    } catch {
      alert('Failed to add member')
    }
  }

  async function addMemberDirect(personId: string) {
    if (!managingGroup) return
    try {
      await apiClient.post(`/groups/${managingGroup.id}/members`, { person_ids: [personId] })
      void openManageMembers(managingGroup)
      void fetchGroups()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string; conflicts?: string[] } } }).response?.data
      if (data?.conflicts) {
        alert(`⚠️ Cannot add:\n\n${data.conflicts.join('\n')}`)
      } else {
        alert(data?.error || 'Failed to add member')
      }
    }
  }

  async function removeMember(personId: string) {
    if (!managingGroup) return
    try {
      await apiClient.delete(`/groups/${managingGroup.id}/members/${personId}`)
      void openManageMembers(managingGroup)
      void fetchGroups()
    } catch {
      alert('Failed to remove member')
    }
  }

  async function openSubjects(group: Group) {
    setSubjectsGroup(group)
    try {
      const res = await apiClient.get('/subjects', { params: { group_id: group.id } })
      setSubjects(res.data.subjects ?? [])
    } catch { setSubjects([]) }
  }

  async function addSubject() {
    if (!subjectsGroup || !newSubject.name.trim()) { alert('Subject name is required'); return }
    try {
      await apiClient.post('/subjects', { group_id: subjectsGroup.id, name: newSubject.name, teacher_name: newSubject.teacher_name || null, period_number: newSubject.period_number ? parseInt(newSubject.period_number) : null })
      setNewSubject({ name: '', teacher_name: '', period_number: '' })
      void openSubjects(subjectsGroup)
    } catch { alert('Failed to add subject') }
  }

  async function deleteSubject(id: string) {
    if (!confirm('Delete this subject?')) return
    try {
      await apiClient.delete(`/subjects/${id}`)
      if (subjectsGroup) void openSubjects(subjectsGroup)
    } catch { alert('Failed to delete') }
  }

  if (loading) return <p>Loading groups...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>🏫 Classes</h1>
        <button onClick={openCreate} style={btnPrimary}>+ Create Class</button>
      </div>

      {/* Group Cards (mobile-friendly) */}
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏫</div>
          <h2 style={{ fontSize: '1.1rem', color: '#475569', margin: '0 0 0.5rem' }}>No Classes Yet</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem' }}>Create a class to organize your students.</p>
          <button onClick={openCreate} style={btnPrimary}>+ Create Class</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {groups.map((g) => (
            <div key={g.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{g.name}</strong>
                  {g.description && <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>{g.description}</p>}
                </div>
                <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>
                  {g.member_count ?? g.members?.length ?? 0} students
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => openEdit(g)} style={actionBtnStyle}>✏️ Edit</button>
                <button onClick={() => void openManageMembers(g)} style={actionBtnStyle}>👥 Members</button>
                <button onClick={() => void openSubjects(g)} style={{ ...actionBtnStyle, color: '#7c3aed' }}>📚 Subjects</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit Group' : 'Create Group'}</h2>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: '60px' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => void handleSave()} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Member Management Modal */}
      {managingGroup && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: '600px' }}>
            <h2 style={{ marginTop: 0 }}>Members: {managingGroup.name}</h2>

            {/* Searchable Add Student */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Add Student</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Search by name or roll number..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  onFocus={() => setShowMemberDropdown(true)}
                />
                {showMemberDropdown && memberSearch.trim().length > 0 && (
                  <div style={dropdownStyle}>
                    {persons
                      .filter(p => !groupMembers.some(m => m.id === p.id))
                      .filter(p => {
                        const q = memberSearch.toLowerCase()
                        return p.name.toLowerCase().includes(q) ||
                          (p.roll_number && p.roll_number.toLowerCase().includes(q)) ||
                          (p.admission_number && p.admission_number.toLowerCase().includes(q))
                      })
                      .slice(0, 10)
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => { setSelectedPersonId(p.id); setMemberSearch(''); setShowMemberDropdown(false); void addMemberDirect(p.id) }}
                          style={dropdownItem}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff' }}
                        >
                          <strong>{p.name}</strong>
                          <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                            {p.roll_number ? `Roll: ${p.roll_number}` : ''} {p.father_name ? `| F: ${p.father_name}` : ''}
                          </span>
                        </div>
                      ))
                    }
                    {persons.filter(p => !groupMembers.some(m => m.id === p.id)).filter(p => {
                      const q = memberSearch.toLowerCase()
                      return p.name.toLowerCase().includes(q) || (p.roll_number && p.roll_number.toLowerCase().includes(q))
                    }).length === 0 && (
                      <div style={{ padding: '0.5rem 0.75rem', color: '#94a3b8', fontSize: '0.85rem' }}>No students found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Member Search */}
            {groupMembers.length > 5 && (
              <input
                style={{ ...inputStyle, marginBottom: '0.75rem' }}
                type="text"
                placeholder="Search members..."
                value={memberListSearch}
                onChange={(e) => setMemberListSearch(e.target.value)}
              />
            )}

            {/* Member List */}
            {groupMembers.length === 0 ? (
              <p style={{ color: '#64748b' }}>No members in this group.</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {groupMembers
                  .filter(m => {
                    if (!memberListSearch) return true
                    const q = memberListSearch.toLowerCase()
                    return m.name.toLowerCase().includes(q) || (m.roll_number && m.roll_number.toLowerCase().includes(q))
                  })
                  .map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <strong>{m.name}</strong>
                        {m.roll_number && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>Roll: {m.roll_number}</span>}
                      </div>
                      <button onClick={() => void removeMember(m.id)} style={{ ...btnSmall, color: '#dc2626' }}>Remove</button>
                    </div>
                  ))
                }
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}</span>
              <button onClick={() => { setManagingGroup(null); setMemberSearch(''); setMemberListSearch('') }} style={btnSecondary}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Subjects Modal */}
      {subjectsGroup && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: '500px' }}>
            <h2 style={{ marginTop: 0 }}>📚 Subjects: {subjectsGroup.name}</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>Add subjects/periods for this class. These appear when marking period-wise attendance.</p>

            {/* Add Subject Form */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: 2, minWidth: '120px' }} placeholder="Subject name (e.g. Maths)" value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })} />
              <input style={{ ...inputStyle, flex: 1, minWidth: '100px' }} placeholder="Teacher (optional)" value={newSubject.teacher_name} onChange={e => setNewSubject({ ...newSubject, teacher_name: e.target.value })} />
              <input style={{ ...inputStyle, width: '60px' }} type="number" placeholder="Period #" value={newSubject.period_number} onChange={e => setNewSubject({ ...newSubject, period_number: e.target.value })} />
              <button onClick={() => void addSubject()} style={btnPrimary}>Add</button>
            </div>

            {/* Subject List */}
            {subjects.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No subjects added yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {subjects.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{s.period_number ? `P${s.period_number}. ` : `${i+1}. `}{s.name}</span>
                      {s.teacher_name && <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.5rem' }}>({s.teacher_name})</span>}
                    </div>
                    <button onClick={() => void deleteSubject(s.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setSubjectsGroup(null)} style={{ ...btnSecondary, marginTop: '1rem' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }
const btnSecondary: React.CSSProperties = { background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSmall: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem' }
const actionBtnStyle: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.3rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', color: '#475569' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box' }
const dropdownStyle: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '2px', maxHeight: '200px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
const dropdownItem: React.CSSProperties = { padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }
