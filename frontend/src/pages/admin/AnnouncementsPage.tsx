import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Announcement {
  id: string
  title: string
  body: string
  target_type: 'Organization' | 'Group' | 'Person'
  target_ids: string[]
  scheduled_at: string | null
  published_at: string | null
  created_at: string
}

interface AnnouncementForm {
  title: string
  body: string
  target_type: 'Organization' | 'Group' | 'Person'
  target_ids: string
  scheduled_at: string
}

const emptyForm: AnnouncementForm = {
  title: '',
  body: '',
  target_type: 'Organization',
  target_ids: '',
  scheduled_at: '',
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [persons, setPersons] = useState<{ id: string; name: string; roll_number?: string; group_name?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AnnouncementForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [personSearch, setPersonSearch] = useState('')
  const [selectedPersons, setSelectedPersons] = useState<{ id: string; name: string; roll_number?: string }[]>([])
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true)
      const [annRes, groupsRes, personsRes] = await Promise.all([
        apiClient.get('/announcements'),
        apiClient.get('/groups'),
        apiClient.get('/persons?limit=100'),
      ])
      setAnnouncements(annRes.data.data ?? [])
      setGroups(groupsRes.data.groups ?? [])
      setPersons(personsRes.data.data ?? [])
    } catch {
      setError('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAnnouncements()
  }, [fetchAnnouncements])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setSelectedPersons([])
    setPersonSearch('')
    setShowModal(true)
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id)
    setForm({
      title: a.title,
      body: a.body,
      target_type: a.target_type,
      target_ids: (a.target_ids ?? []).join(', '),
      scheduled_at: a.scheduled_at ? a.scheduled_at.slice(0, 16) : '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        body: form.body,
        target_type: form.target_type,
        target_ids: form.target_type === 'Organization' ? [] : (form.target_ids ? form.target_ids.split(',').map((s) => s.trim()).filter(Boolean) : []),
        scheduled_at: form.scheduled_at || null,
      }
      if (editingId) {
        await apiClient.put(`/announcements/${editingId}`, payload)
      } else {
        await apiClient.post('/announcements', payload)
      }
      setShowModal(false)
      void fetchAnnouncements()
    } catch {
      alert('Failed to save announcement')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(id: string) {
    try {
      await apiClient.post(`/announcements/${id}/publish`)
      void fetchAnnouncements()
    } catch {
      alert('Failed to publish announcement')
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete announcement "${title}"? This will remove it from parents too.`)) return
    try {
      await apiClient.delete(`/announcements/${id}`)
      void fetchAnnouncements()
    } catch {
      alert('Failed to delete announcement')
    }
  }

  if (loading) return <p>Loading announcements...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>Announcements</h1>
        <button onClick={openCreate} style={{ ...btnPrimary, padding: '0.6rem 1rem', fontSize: '0.85rem' }}>+ Create</button>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Target</th>
            <th style={thStyle}>Scheduled</th>
            <th style={thStyle}>Published</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {announcements.map((a) => (
            <tr key={a.id}>
              <td style={tdStyle} data-label="Title">{a.title}</td>
              <td style={tdStyle} data-label="Target">{a.target_type}</td>
              <td style={tdStyle} data-label="Scheduled">{a.scheduled_at ? new Date(a.scheduled_at).toLocaleString() : '—'}</td>
              <td style={tdStyle} data-label="Published">{a.published_at ? new Date(a.published_at).toLocaleString() : 'Not published'}</td>
              <td style={tdStyle} data-label="Actions">
                <button onClick={() => openEdit(a)} style={btnSmall}>Edit</button>
                {!a.published_at && (
                  <button onClick={() => void handlePublish(a.id)} style={{ ...btnSmall, marginLeft: '0.5rem', color: '#16a34a' }}>Publish</button>
                )}
                <button onClick={() => void handleDelete(a.id, a.title)} style={{ ...btnSmall, marginLeft: '0.5rem', color: '#dc2626' }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {announcements.length === 0 && <p style={{ color: '#64748b', marginTop: '1rem' }}>No announcements yet.</p>}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit Announcement' : 'Create Announcement'}</h2>

            {/* Quick Templates */}
            {!editingId && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.5rem' }}>Quick Templates:</p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setForm({ ...form, title: 'Fee Payment Reminder', body: 'Dear Parents,\n\nThis is a reminder that the fee payment for this term is due. Kindly make the payment at the earliest.\n\nPlease ignore this message if you have already paid.\n\nThank you.' })} style={templateBtn}>💰 Fee Payment Due</button>
                  <button type="button" onClick={() => setForm({ ...form, title: 'Holiday Notice - Government Declaration', body: 'Dear Parents,\n\nPlease be informed that the school will remain closed tomorrow as declared by the government.\n\nClasses will resume as per regular schedule the next working day.\n\nThank you.' })} style={templateBtn}>🏛️ Govt Holiday</button>
                  <button type="button" onClick={() => setForm({ ...form, title: 'Holiday Notice - Heavy Rain', body: 'Dear Parents,\n\nDue to heavy rainfall and waterlogging conditions, the school will remain closed today for the safety of students.\n\nClasses will resume once the weather improves. Stay safe.\n\nThank you.' })} style={templateBtn}>🌧️ Rain Holiday</button>
                  <button type="button" onClick={() => setForm({ ...form, title: 'Parent-Teacher Meeting', body: 'Dear Parents,\n\nYou are cordially invited for a Parent-Teacher Meeting scheduled on [DATE] at [TIME].\n\nYour presence is important to discuss your child\'s progress.\n\nThank you.' })} style={templateBtn}>👨‍👩‍👧 PTM</button>
                  <button type="button" onClick={() => setForm({ ...form, title: 'Exam Schedule', body: 'Dear Parents,\n\nPlease find below the exam schedule for the upcoming examination:\n\n[Add dates and subjects here]\n\nKindly ensure your child is well-prepared.\n\nThank you.' })} style={templateBtn}>📝 Exam Schedule</button>
                  <button type="button" onClick={() => setForm({ ...form, title: 'Event Celebration', body: 'Dear Parents,\n\nWe are delighted to inform you that our school is organizing [EVENT NAME] on [DATE].\n\nAll students are requested to participate.\n\nThank you.' })} style={templateBtn}>🎉 Event</button>
                </div>
              </div>
            )}

            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label style={labelStyle}>Body</label>
            <textarea style={{ ...inputStyle, minHeight: '80px' }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <label style={labelStyle}>Target Type</label>
            <select style={inputStyle} value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value as AnnouncementForm['target_type'] })}>
              <option value="Organization">Organization</option>
              <option value="Group">Group</option>
              <option value="Person">Person</option>
            </select>
            {form.target_type !== 'Organization' && (
              <>
                {form.target_type === 'Group' && (
                  <>
                    <label style={labelStyle}>Select Class</label>
                    <select style={inputStyle} value={form.target_ids} onChange={(e) => setForm({ ...form, target_ids: e.target.value })}>
                      <option value="">Select a class...</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </>
                )}
                {form.target_type === 'Person' && (
                  <>
                    <label style={labelStyle}>Select Students</label>
                    {/* Selected students chips */}
                    {selectedPersons.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
                        {selectedPersons.map(p => (
                          <span key={p.id} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {p.name} {p.roll_number && `(${p.roll_number})`}
                            <button onClick={() => { setSelectedPersons(selectedPersons.filter(s => s.id !== p.id)); setForm({ ...form, target_ids: selectedPersons.filter(s => s.id !== p.id).map(s => s.id).join(',') }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.9rem', padding: 0 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Searchable input */}
                    <div style={{ position: 'relative' }}>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="Search by name or roll number..."
                        value={personSearch}
                        onChange={(e) => { setPersonSearch(e.target.value); setShowPersonDropdown(true) }}
                        onFocus={() => setShowPersonDropdown(true)}
                      />
                      {showPersonDropdown && personSearch.trim().length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '2px', maxHeight: '180px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {persons
                            .filter(p => !selectedPersons.some(s => s.id === p.id))
                            .filter(p => {
                              const q = personSearch.toLowerCase()
                              return p.name.toLowerCase().includes(q) || (p.roll_number && p.roll_number.toLowerCase().includes(q))
                            })
                            .slice(0, 10)
                            .map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  const newSelected = [...selectedPersons, p]
                                  setSelectedPersons(newSelected)
                                  setForm({ ...form, target_ids: newSelected.map(s => s.id).join(',') })
                                  setPersonSearch('')
                                  setShowPersonDropdown(false)
                                }}
                                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }}
                              >
                                <strong>{p.name}</strong>
                                <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                                  {p.roll_number ? `Roll: ${p.roll_number}` : ''} {p.group_name ? `| ${p.group_name}` : ''}
                                </span>
                              </div>
                            ))
                          }
                          {persons.filter(p => !selectedPersons.some(s => s.id === p.id)).filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase()) || (p.roll_number && p.roll_number.toLowerCase().includes(personSearch.toLowerCase()))).length === 0 && (
                            <div style={{ padding: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>No students found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
            <label style={labelStyle}>Schedule At (optional)</label>
            <input style={inputStyle} type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => void handleSave()} disabled={saving} style={btnPrimary}>{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSecondary: React.CSSProperties = { background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSmall: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box' }
const templateBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }
