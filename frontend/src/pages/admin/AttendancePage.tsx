import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Group { id: string; name: string }
interface Person { id: string; name: string; roll_number?: string }
interface Subject { id: string; name: string; teacher_name?: string; period_number?: number }
type MarkingMode = 'absent_only' | 'present_only'

export default function AttendancePage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
  const [members, setMembers] = useState<Person[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [markedDates, setMarkedDates] = useState<string[]>([])
  const [markedPeriods, setMarkedPeriods] = useState<string[]>([]) // period_labels marked for selected date
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [markingMode, setMarkingMode] = useState<MarkingMode>('absent_only')
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchGroups = useCallback(async () => {
    try { const res = await apiClient.get('/groups'); setGroups(res.data.groups ?? []) }
    catch { setError('Failed to load classes') }
  }, [])

  useEffect(() => { void fetchGroups() }, [fetchGroups])

  // Load members + subjects when group changes
  async function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId)
    setSelectedStudents(new Set())
    setSuccess(''); setError('')
    if (!groupId) { setMembers([]); setSubjects([]); return }
    setLoading(true)
    try {
      const [membersRes, subjectsRes] = await Promise.all([
        apiClient.get(`/groups/${groupId}`),
        apiClient.get('/subjects', { params: { group_id: groupId } }),
      ])
      setMembers(membersRes.data.group?.members ?? [])
      setSubjects(subjectsRes.data.subjects ?? [])
      // Fetch marked dates for this month
      void fetchMarkedDates(groupId, currentMonth)
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }

  // Fetch which dates have attendance marked
  async function fetchMarkedDates(groupId: string, month: Date) {
    try {
      const res = await apiClient.get('/attendance/marked-dates', {
        params: { group_id: groupId, year: month.getFullYear(), month: month.getMonth() + 1 }
      })
      setMarkedDates(res.data.marked_dates ?? [])
    } catch { setMarkedDates([]) }
  }

  // Fetch which periods are marked for selected date
  async function fetchMarkedPeriods(groupId: string, date: string) {
    try {
      const res = await apiClient.get('/attendance', {
        params: { start_date: date, end_date: date, group_id: groupId, limit: 100 }
      })
      const records = res.data.data ?? []
      const periods = [...new Set(records.map((r: { period_label: string }) => r.period_label))]
      setMarkedPeriods(periods)
    } catch { setMarkedPeriods([]) }
  }

  function handleDateClick(dateStr: string) {
    setSelectedDate(dateStr)
    setSuccess(''); setError('')
    setSelectedStudents(new Set())
    if (selectedGroupId) void fetchMarkedPeriods(selectedGroupId, dateStr)
  }

  // Month navigation
  function prevMonth() {
    const m = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    setCurrentMonth(m)
    if (selectedGroupId) void fetchMarkedDates(selectedGroupId, m)
  }
  function nextMonth() {
    const m = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(m)
    if (selectedGroupId) void fetchMarkedDates(selectedGroupId, m)
  }

  function toggleStudent(id: string) {
    setSelectedStudents(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function handleSubmit() {
    if (!selectedGroupId || !selectedDate) return
    // Determine period label
    const periodLabel = selectedSubjectId ? (subjects.find(s => s.id === selectedSubjectId)?.name || 'Period') : 'Full Day'
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const promises = members.map(member => {
        const status = markingMode === 'absent_only'
          ? (selectedStudents.has(member.id) ? 'Absent' : 'Present')
          : (selectedStudents.has(member.id) ? 'Present' : 'Absent')
        return apiClient.post('/attendance', {
          person_id: member.id, date: selectedDate, presence_status: status,
          subject_id: selectedSubjectId || undefined, period_label: periodLabel,
        })
      })
      await Promise.all(promises)
      const absentCount = markingMode === 'absent_only' ? selectedStudents.size : members.length - selectedStudents.size
      setSuccess(`✓ ${periodLabel} — ${members.length - absentCount} present, ${absentCount} absent`)
      setSelectedStudents(new Set())
      // Refresh marked dates & periods
      void fetchMarkedDates(selectedGroupId, currentMonth)
      void fetchMarkedPeriods(selectedGroupId, selectedDate)
    } catch { setError('Failed to save') }
    finally { setSubmitting(false) }
  }

  const filteredMembers = members.filter(m => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return m.name.toLowerCase().includes(q) || (m.roll_number && m.roll_number.toLowerCase().includes(q))
  })

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>✅ Record Attendance</h1>

      {/* Class Selector */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {groups.map(g => (
          <button key={g.id} onClick={() => void handleGroupChange(g.id)}
            style={{ padding: '0.45rem 0.9rem', borderRadius: '20px', border: g.id === selectedGroupId ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: g.id === selectedGroupId ? '#eff6ff' : '#fff', color: g.id === selectedGroupId ? '#1d4ed8' : '#475569', cursor: 'pointer', fontSize: '0.85rem', fontWeight: g.id === selectedGroupId ? 600 : 400 }}>
            {g.name}
          </button>
        ))}
      </div>

      {selectedGroupId && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>

          {/* Calendar with marked dates */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <button onClick={prevMonth} style={calBtn}>◀</button>
              <strong style={{ fontSize: '0.95rem' }}>{currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
              <button onClick={nextMonth} style={calBtn}>▶</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', textAlign: 'center' }}>
              {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, padding: '0.3rem' }}>{d}</div>)}
              {renderCalendar(currentMonth, selectedDate, todayStr, markedDates, handleDateClick)}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', justifyContent: 'center', fontSize: '0.7rem', color: '#64748b' }}>
              <span>🟢 Marked</span> <span>🔵 Today</span> <span>⚪ Not marked</span>
            </div>
          </div>

          {/* Period Status for selected date */}
          {subjects.length > 0 && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                📋 Status for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}:
              </p>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {markedPeriods.includes('Full Day') && (
                  <span style={{ ...periodChip, background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>✓ Full Day</span>
                )}
                {subjects.map(s => {
                  const isMarked = markedPeriods.includes(s.name)
                  return (
                    <span key={s.id} style={{ ...periodChip, background: isMarked ? '#dcfce7' : '#fff', color: isMarked ? '#166534' : '#94a3b8', border: isMarked ? '1px solid #86efac' : '1px solid #e2e8f0' }}>
                      {isMarked ? '✓' : '○'} {s.period_number ? `P${s.period_number}` : ''} {s.name}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Period Selector */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Mark attendance for:</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <button onClick={() => setSelectedSubjectId('')} style={{ ...periodBtn, background: !selectedSubjectId ? '#eff6ff' : '#fff', color: !selectedSubjectId ? '#1d4ed8' : '#475569', border: !selectedSubjectId ? '2px solid #3b82f6' : '1px solid #e2e8f0' }}>
                📅 Full Day
              </button>
              {subjects.map(s => (
                <button key={s.id} onClick={() => setSelectedSubjectId(s.id)} style={{ ...periodBtn, background: selectedSubjectId === s.id ? '#f5f3ff' : '#fff', color: selectedSubjectId === s.id ? '#7c3aed' : '#475569', border: selectedSubjectId === s.id ? '2px solid #8b5cf6' : '1px solid #e2e8f0' }}>
                  {s.period_number ? `P${s.period_number}. ` : ''}{s.name}
                </button>
              ))}
            </div>

            {/* Marking Mode */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '3px', marginBottom: '0.75rem', width: 'fit-content' }}>
              <button onClick={() => { setMarkingMode('absent_only'); setSelectedStudents(new Set()) }}
                style={{ ...modeBtn, background: markingMode === 'absent_only' ? '#fff' : 'transparent', color: markingMode === 'absent_only' ? '#dc2626' : '#64748b', boxShadow: markingMode === 'absent_only' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                Mark Absentees
              </button>
              <button onClick={() => { setMarkingMode('present_only'); setSelectedStudents(new Set()) }}
                style={{ ...modeBtn, background: markingMode === 'present_only' ? '#fff' : 'transparent', color: markingMode === 'present_only' ? '#16a34a' : '#64748b', boxShadow: markingMode === 'present_only' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                Mark Present
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
              {markingMode === 'absent_only' ? '✋ Tap absent students. Rest = Present.' : '👋 Tap present students. Rest = Absent.'}
            </p>

            {/* Search */}
            <input style={inputStyle} type="text" placeholder="Search students..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />

            {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.5rem 0' }}>{error}</p>}
            {success && <p style={{ color: '#16a34a', fontSize: '0.8rem', margin: '0.5rem 0' }}>{success}</p>}

            {/* Student Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '5px', marginTop: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
              {filteredMembers.map(m => {
                const isSelected = selectedStudents.has(m.id)
                return (
                  <div key={m.id} onClick={() => toggleStudent(m.id)} style={{
                    padding: '0.4rem 0.6rem', borderRadius: '8px', cursor: 'pointer', userSelect: 'none',
                    border: `2px solid ${isSelected ? (markingMode === 'absent_only' ? '#fca5a5' : '#86efac') : '#e2e8f0'}`,
                    background: isSelected ? (markingMode === 'absent_only' ? '#fef2f2' : '#dcfce7') : '#fff',
                  }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{m.name}</div>
                    {m.roll_number && <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Roll: {m.roll_number}</div>}
                    {isSelected && <div style={{ fontSize: '0.6rem', fontWeight: 700, color: markingMode === 'absent_only' ? '#dc2626' : '#16a34a' }}>{markingMode === 'absent_only' ? '✗ ABSENT' : '✓ PRESENT'}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Loading...</p>}

      {/* Sticky Save Button */}
      {selectedGroupId && members.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '0.75rem 1rem', margin: '0 -1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -2px 8px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#475569' }}>
            {selectedStudents.size} selected • {!selectedSubjectId ? 'Full Day' : subjects.find(s => s.id === selectedSubjectId)?.name}
          </span>
          <button onClick={() => void handleSubmit()} disabled={submitting} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Saving...' : '✓ Save Attendance'}
          </button>
        </div>
      )}
    </div>
  )
}

function renderCalendar(month: Date, selectedDate: string, todayStr: string, markedDates: string[], onDateClick: (d: string) => void) {
  const y = month.getFullYear(), m = month.getMonth()
  const firstDay = new Date(y, m, 1).getDay()
  const lastDate = new Date(y, m+1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`}></div>)
  for (let day = 1; day <= lastDate; day++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const isSelected = ds === selectedDate
    const isToday = ds === todayStr
    const isMarked = markedDates.includes(ds)
    const isWeekend = new Date(y, m, day).getDay() === 0 || new Date(y, m, day).getDay() === 6
    cells.push(
      <div key={ds} onClick={() => onDateClick(ds)} style={{
        padding: '0.3rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', position: 'relative',
        background: isSelected ? '#3b82f6' : isToday ? '#eff6ff' : 'transparent',
        color: isSelected ? '#fff' : isToday ? '#1d4ed8' : isWeekend ? '#94a3b8' : '#374151',
        border: isToday && !isSelected ? '1px solid #93c5fd' : '1px solid transparent',
        fontSize: '0.8rem', fontWeight: isSelected || isToday ? 600 : 400,
      }}>
        {day}
        {isMarked && !isSelected && <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>}
      </div>
    )
  }
  return cells
}

const calBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.85rem' }
const periodBtn: React.CSSProperties = { padding: '0.4rem 0.7rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }
const periodChip: React.CSSProperties = { padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 500 }
const modeBtn: React.CSSProperties = { border: 'none', padding: '0.4rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box', marginBottom: '0.5rem' }
