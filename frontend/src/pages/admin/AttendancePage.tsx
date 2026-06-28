import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface Group {
  id: string
  name: string
}

interface Person {
  id: string
  name: string
  roll_number?: string
}

type MarkingMode = 'individual' | 'absent_only' | 'present_only'
type AttendanceType = 'full_day' | 'period_wise'

interface Subject {
  id: string
  name: string
  teacher_name?: string
  period_number?: number
}

export default function AttendancePage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [members, setMembers] = useState<Person[]>([])
  const [markingMode, setMarkingMode] = useState<MarkingMode>('absent_only')
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  // Period-wise
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('full_day')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState('')

  const fetchGroups = useCallback(async () => {
    try {
      const res = await apiClient.get('/groups')
      setGroups(res.data.groups ?? [])
    } catch {
      setError('Failed to load classes')
    }
  }, [])

  useEffect(() => { void fetchGroups() }, [fetchGroups])

  async function loadGroupMembers(groupId: string) {
    if (!groupId) { setMembers([]); setSubjects([]); return }
    setLoading(true)
    try {
      const [membersRes, subjectsRes] = await Promise.all([
        apiClient.get(`/groups/${groupId}`),
        apiClient.get('/subjects', { params: { group_id: groupId } }),
      ])
      setMembers(membersRes.data.group?.members ?? [])
      setSubjects(subjectsRes.data.subjects ?? [])
      setSelectedStudents(new Set())
      setSelectedSubjectId('')
    } catch {
      setError('Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId)
    void loadGroupMembers(groupId)
    setSuccess('')
    setError('')
  }

  function handleDateClick(dateStr: string) {
    setSelectedDate(dateStr)
    setSuccess('')
    setError('')
  }

  function toggleStudent(personId: string) {
    setSelectedStudents(prev => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  function selectAll() {
    setSelectedStudents(new Set(filteredMembers.map(m => m.id)))
  }

  function deselectAll() {
    setSelectedStudents(new Set())
  }

  async function handleSubmit() {
    if (!selectedGroupId || !selectedDate) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const promises = members.map(member => {
        let status: string
        if (markingMode === 'absent_only') {
          status = selectedStudents.has(member.id) ? 'Absent' : 'Present'
        } else if (markingMode === 'present_only') {
          status = selectedStudents.has(member.id) ? 'Present' : 'Absent'
        } else {
          status = selectedStudents.has(member.id) ? 'Absent' : 'Present'
        }
        return apiClient.post('/attendance', {
          person_id: member.id,
          date: selectedDate,
          presence_status: status,
          subject_id: attendanceType === 'period_wise' && selectedSubjectId ? selectedSubjectId : undefined,
          period_label: attendanceType === 'period_wise' && selectedSubjectId
            ? (subjects.find(s => s.id === selectedSubjectId)?.name || 'Period')
            : 'Full Day',
        })
      })
      await Promise.all(promises)
      const absentCount = markingMode === 'absent_only' ? selectedStudents.size : members.length - selectedStudents.size
      const periodInfo = attendanceType === 'period_wise' ? ` (${subjects.find(s => s.id === selectedSubjectId)?.name || 'Period'})` : ''
      setSuccess(`Attendance saved! ${members.length - absentCount} present, ${absentCount} absent for ${selectedDate}${periodInfo}`)
      setSelectedStudents(new Set())
    } catch {
      setError('Failed to record attendance')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMembers = members.filter(m => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return m.name.toLowerCase().includes(q) || (m.roll_number && m.roll_number.toLowerCase().includes(q))
  })

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Record Attendance</h1>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Select a class, pick a date from the calendar, then mark attendance.
      </p>

      {/* Class Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Select Class</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => handleGroupChange(g.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: g.id === selectedGroupId ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                background: g.id === selectedGroupId ? '#eff6ff' : '#fff',
                color: g.id === selectedGroupId ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: g.id === selectedGroupId ? 600 : 400,
              }}
            >
              {g.name}
            </button>
          ))}
          {groups.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No classes found. Create one in Groups.</p>}
        </div>
      </div>

      {/* Mini Calendar */}
      {selectedGroupId && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={calNavBtn}>&lt;</button>
            <strong style={{ fontSize: '0.9rem' }}>{currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={calNavBtn}>&gt;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', textAlign: 'center' }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, padding: '0.25rem' }}>{d}</div>
            ))}
            {renderMiniCalendar(currentMonth, selectedDate, todayStr, handleDateClick)}
          </div>
        </div>
      )}

      {/* Marking Mode & Student List */}
      {selectedGroupId && members.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>

          {/* Attendance Type: Full Day vs Period-wise */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
              <button onClick={() => { setAttendanceType('full_day'); setSelectedSubjectId('') }}
                style={{ ...modeBtn, background: attendanceType === 'full_day' ? '#fff' : 'transparent', color: attendanceType === 'full_day' ? '#1e293b' : '#64748b', boxShadow: attendanceType === 'full_day' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                📅 Full Day
              </button>
              <button onClick={() => setAttendanceType('period_wise')}
                style={{ ...modeBtn, background: attendanceType === 'period_wise' ? '#fff' : 'transparent', color: attendanceType === 'period_wise' ? '#7c3aed' : '#64748b', boxShadow: attendanceType === 'period_wise' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                disabled={subjects.length === 0}>
                📚 Period-wise
              </button>
            </div>
            {attendanceType === 'period_wise' && subjects.length > 0 && (
              <select style={{ padding: '0.4rem 0.6rem', border: '1px solid #c4b5fd', borderRadius: '6px', fontSize: '0.85rem', background: '#f5f3ff', color: '#5b21b6' }} value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
                <option value="">Select subject/period...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.period_number ? `P${s.period_number}. ` : ''}{s.name}{s.teacher_name ? ` (${s.teacher_name})` : ''}</option>
                ))}
              </select>
            )}
            {subjects.length === 0 && attendanceType === 'period_wise' && (
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No subjects configured. Add them in Classes → Subjects.</span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>Date: </span>
              <strong style={{ color: '#1e293b' }}>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</strong>
              <span style={{ marginLeft: '1rem', fontSize: '0.85rem', color: '#475569' }}>{members.length} students</span>
              {attendanceType === 'period_wise' && selectedSubjectId && (
                <span style={{ marginLeft: '0.5rem', background: '#f5f3ff', color: '#7c3aed', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                  {subjects.find(s => s.id === selectedSubjectId)?.name}
                </span>
              )}
            </div>

            {/* Marking Mode Toggle */}
            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
              <button
                onClick={() => { setMarkingMode('absent_only'); setSelectedStudents(new Set()) }}
                style={{ ...modeBtn, background: markingMode === 'absent_only' ? '#fff' : 'transparent', color: markingMode === 'absent_only' ? '#dc2626' : '#64748b', boxShadow: markingMode === 'absent_only' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              >
                Mark Absentees
              </button>
              <button
                onClick={() => { setMarkingMode('present_only'); setSelectedStudents(new Set()) }}
                style={{ ...modeBtn, background: markingMode === 'present_only' ? '#fff' : 'transparent', color: markingMode === 'present_only' ? '#16a34a' : '#64748b', boxShadow: markingMode === 'present_only' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              >
                Mark Present
              </button>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
            {markingMode === 'absent_only'
              ? '✋ Select students who are ABSENT. Everyone else will be marked Present.'
              : '👋 Select students who are PRESENT. Everyone else will be marked Absent.'}
          </p>

          {/* Search + Select All */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button onClick={selectAll} style={smallBtn}>Select All</button>
            <button onClick={deselectAll} style={smallBtn}>Clear</button>
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>}
          {success && <p style={{ color: '#16a34a', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{success}</p>}

          {/* Student Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
            {filteredMembers.map(m => {
              const isSelected = selectedStudents.has(m.id)
              const bgColor = isSelected
                ? (markingMode === 'absent_only' ? '#fef2f2' : '#dcfce7')
                : '#fff'
              const borderColor = isSelected
                ? (markingMode === 'absent_only' ? '#fca5a5' : '#86efac')
                : '#e2e8f0'

              return (
                <div
                  key={m.id}
                  onClick={() => toggleStudent(m.id)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: `2px solid ${borderColor}`,
                    background: bgColor,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#1e293b' }}>{m.name}</div>
                  {m.roll_number && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Roll: {m.roll_number}</div>}
                  {isSelected && (
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, marginTop: '2px', color: markingMode === 'absent_only' ? '#dc2626' : '#16a34a' }}>
                      {markingMode === 'absent_only' ? '✗ ABSENT' : '✓ PRESENT'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.85rem', color: '#475569' }}>
              {selectedStudents.size} selected as {markingMode === 'absent_only' ? 'absent' : 'present'}
              {' • '}
              {markingMode === 'absent_only'
                ? `${members.length - selectedStudents.size} will be present`
                : `${members.length - selectedStudents.size} will be absent`
              }
            </span>
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || members.length === 0}
              style={{ ...submitBtn, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: '#64748b', marginTop: '1rem' }}>Loading students...</p>}
    </div>
  )
}

function renderMiniCalendar(month: Date, selectedDate: string, todayStr: string, onDateClick: (d: string) => void) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1).getDay()
  const lastDate = new Date(year, m + 1, 0).getDate()
  const cells = []

  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e-${i}`}></div>)
  }

  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isSelected = dateStr === selectedDate
    const isToday = dateStr === todayStr
    const isWeekend = new Date(year, m, day).getDay() === 0 || new Date(year, m, day).getDay() === 6

    cells.push(
      <div
        key={dateStr}
        onClick={() => onDateClick(dateStr)}
        onDoubleClick={() => onDateClick(dateStr)}
        style={{
          padding: '0.35rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: isSelected || isToday ? 600 : 400,
          background: isSelected ? '#3b82f6' : isToday ? '#eff6ff' : 'transparent',
          color: isSelected ? '#fff' : isToday ? '#1d4ed8' : isWeekend ? '#94a3b8' : '#374151',
          border: isToday && !isSelected ? '1px solid #93c5fd' : '1px solid transparent',
        }}
      >
        {day}
      </div>
    )
  }

  return cells
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }
const inputStyle: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }
const calNavBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.85rem' }
const modeBtn: React.CSSProperties = { border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s' }
const smallBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.35rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#475569' }
const submitBtn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }
