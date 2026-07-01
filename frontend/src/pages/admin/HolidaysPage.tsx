import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Holiday {
  id: string
  date: string
  name: string
  type: string
  description?: string
}

const presetHolidays = [
  { name: 'Republic Day', date: '01-26' },
  { name: 'Independence Day', date: '08-15' },
  { name: 'Gandhi Jayanti', date: '10-02' },
  { name: 'Diwali', date: '' },
  { name: 'Holi', date: '' },
  { name: 'Christmas', date: '12-25' },
  { name: 'Eid', date: '' },
  { name: 'Ganesh Chaturthi', date: '' },
  { name: 'Dussehra', date: '' },
  { name: 'Raksha Bandhan', date: '' },
]

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '', name: '', type: 'holiday', description: '' })
  const [saving, setSaving] = useState(false)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/holidays', { params: { year: currentYear } })
      setHolidays(res.data.holidays ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [currentYear])

  useEffect(() => { void fetchHolidays() }, [fetchHolidays])

  async function handleAdd() {
    if (!form.date || !form.name) { alert('Date and name are required'); return }
    setSaving(true)
    try {
      await apiClient.post('/holidays', form)
      setForm({ date: '', name: '', type: 'holiday', description: '' })
      setShowForm(false)
      void fetchHolidays()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to add holiday'
      alert(msg)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete holiday "${name}"?`)) return
    try {
      await apiClient.delete(`/holidays/${id}`)
      void fetchHolidays()
    } catch { alert('Failed to delete') }
  }

  function applyPreset(preset: { name: string; date: string }) {
    const year = currentYear
    const fullDate = preset.date ? `${year}-${preset.date}` : ''
    setForm({ ...form, name: preset.name, date: fullDate })
    setShowForm(true)
  }

  if (loading) return <p>Loading holidays...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          🗓️ School Holidays
          <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '0.75rem' }}>{currentYear}</span>
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setCurrentYear(currentYear - 1)} style={navBtn}>← {currentYear - 1}</button>
          <button onClick={() => setCurrentYear(currentYear + 1)} style={navBtn}>{currentYear + 1} →</button>
          <button onClick={() => setShowForm(true)} style={addBtn}>+ Add Holiday</button>
        </div>
      </div>

      {/* Quick Presets */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', marginBottom: '1.5rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b' }}>Quick Add (click to pre-fill):</p>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {presetHolidays.map(p => (
            <button key={p.name} onClick={() => applyPreset(p)} style={presetBtn}>{p.name}</button>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Add Holiday</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Holiday Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="e.g. Diwali" />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                <option value="holiday">Full Holiday</option>
                <option value="half_day">Half Day</option>
                <option value="event">Event (School Open)</option>
              </select>
            </div>
            <button onClick={() => void handleAdd()} disabled={saving} style={addBtn}>{saving ? 'Adding...' : 'Add'}</button>
            <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Calendar View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
        {[...Array(12)].map((_, monthIdx) => {
          const monthHolidays = holidays.filter(h => {
            const m = parseInt(h.date.split('-')[1], 10)
            return m === monthIdx + 1
          })
          const monthName = new Date(currentYear, monthIdx).toLocaleDateString('en-IN', { month: 'long' })

          return (
            <div key={monthIdx} style={monthCard}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#1e293b' }}>{monthName}</h4>
              {monthHolidays.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>No holidays</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {monthHolidays.map(h => (
                    <div key={h.id} style={holidayRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ ...typeDot, background: h.type === 'holiday' ? '#8b5cf6' : h.type === 'half_day' ? '#f59e0b' : '#3b82f6' }}></span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatDay(h.date)}</span>
                        <strong style={{ fontSize: '0.85rem' }}>{h.name}</strong>
                      </div>
                      <button onClick={() => void handleDelete(h.id, h.name)} style={delBtn}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  } catch { return dateStr }
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }
const inputStyle: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }
const addBtn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }
const cancelBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.45rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' }
const navBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.35rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }
const presetBtn: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }
const monthCard: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }
const holidayRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid #f8fafc' }
const typeDot: React.CSSProperties = { width: '8px', height: '8px', borderRadius: '50%' }
const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1rem', padding: '0 0.3rem' }
