import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface PersonStatus {
  presence_status: string
  time: string
}

interface Person {
  id: string
  name: string
  relationship: string
  is_active: boolean
  roll_number?: string
  current_status: PersonStatus | null
}

interface AttendanceRecord {
  id: string
  date: string
  time: string
  presence_status: string
}

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [holidays, setHolidays] = useState<{ date: string; name: string; type: string }[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const fetchPersons = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get('/portal/persons')
      setPersons(res.data.persons ?? [])
    } catch {
      setError('Failed to load children')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchPersons() }, [fetchPersons])

  // Auto-select first child and fetch attendance
  useEffect(() => {
    if (persons.length > 0 && !selectedPersonId) {
      setSelectedPersonId(persons[0].id)
    }
  }, [persons, selectedPersonId])

  // Fetch attendance for current month whenever person or month changes
  const fetchMonthAttendance = useCallback(async (personId: string, month: Date) => {
    try {
      setAttendanceLoading(true)
      const year = month.getFullYear()
      const m = month.getMonth()
      const startDate = `${year}-${String(m + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, m + 1, 0).getDate()
      const endDate = `${year}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const [attendanceRes, holidaysRes] = await Promise.all([
        apiClient.get(`/portal/persons/${personId}/attendance`, { params: { start_date: startDate, end_date: endDate } }),
        apiClient.get('/holidays', { params: { year, month: m + 1 } }),
      ])
      setAttendance(attendanceRes.data.attendance ?? [])
      setHolidays(holidaysRes.data.holidays ?? [])
    } catch {
      setAttendance([])
      setHolidays([])
    } finally {
      setAttendanceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedPersonId) {
      void fetchMonthAttendance(selectedPersonId, currentMonth)
    }
  }, [selectedPersonId, currentMonth, fetchMonthAttendance])

  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  function goToToday() {
    setCurrentMonth(new Date())
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  const selectedPerson = persons.find(p => p.id === selectedPersonId)
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>My Children</h1>

      {persons.length === 0 && (
        <p style={{ color: '#64748b' }}>No children associated with your account.</p>
      )}

      {/* Child Selector Tabs */}
      {persons.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {persons.map(person => (
            <button
              key={person.id}
              onClick={() => setSelectedPersonId(person.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: person.id === selectedPersonId ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                background: person.id === selectedPersonId ? '#eff6ff' : '#fff',
                color: person.id === selectedPersonId ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: person.id === selectedPersonId ? 600 : 400,
              }}
            >
              {person.name}
              {person.roll_number && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.3rem' }}>({person.roll_number})</span>}
            </button>
          ))}
        </div>
      )}

      {/* Today's Status Banner */}
      {selectedPerson && (
        <div style={todayBanner}>
          <div>
            <strong>{selectedPerson.name}</strong>
            <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.85rem' }}>({selectedPerson.relationship})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Today:</span>
            <span style={{ ...statusBadge, background: statusBg(selectedPerson.current_status?.presence_status), color: statusFg(selectedPerson.current_status?.presence_status) }}>
              {formatStatus(selectedPerson.current_status?.presence_status)}
            </span>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {selectedPersonId && (
        <div style={calendarContainer}>
          {/* Calendar Header */}
          <div style={calendarHeader}>
            <button onClick={prevMonth} style={navBtn}>&lt;</button>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={nextMonth} style={navBtn}>&gt;</button>
            <button onClick={goToToday} style={{ ...navBtn, marginLeft: '0.5rem', fontSize: '0.75rem' }}>Today</button>
          </div>

          {attendanceLoading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Loading...</p>
          ) : (
            <>
              {/* Day headers */}
              <div style={calendarGrid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} style={dayHeader}>{day}</div>
                ))}
              </div>

              {/* Calendar Days */}
              <div style={calendarGrid}>
                {renderCalendarDays(currentMonth, attendance, holidays, todayStr)}
              </div>
            </>
          )}

          {/* Legend */}
          <div style={legendStyle}>
            <LegendItem color="#dcfce7" textColor="#16a34a" label="Present" />
            <LegendItem color="#fef2f2" textColor="#dc2626" label="Absent" />
            <LegendItem color="#fefce8" textColor="#d97706" label="Late" />
            <LegendItem color="#eff6ff" textColor="#2563eb" label="On Leave" />
            <LegendItem color="#f3e8ff" textColor="#7c3aed" label="Holiday" />
            <LegendItem color="#f8fafc" textColor="#94a3b8" label="No Record" />
          </div>
        </div>
      )}
    </div>
  )
}

function renderCalendarDays(month: Date, attendance: { date: string; presence_status: string }[], holidays: { date: string; name: string; type: string }[], todayStr: string) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1).getDay()
  const lastDate = new Date(year, m + 1, 0).getDate()

  // Build attendance map
  const attendanceMap = new Map<string, string>()
  for (const record of attendance) {
    const dateStr = record.date.split('T')[0]
    attendanceMap.set(dateStr, record.presence_status)
  }

  // Build holiday map
  const holidayMap = new Map<string, string>()
  for (const h of holidays) {
    const dateStr = h.date.split('T')[0]
    holidayMap.set(dateStr, h.name)
  }

  const cells = []

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} style={emptyCell}></div>)
  }

  // Day cells
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const status = attendanceMap.get(dateStr)
    const holiday = holidayMap.get(dateStr)
    const isToday = dateStr === todayStr
    const isWeekend = new Date(year, m, day).getDay() === 0 || new Date(year, m, day).getDay() === 6

    cells.push(
      <div
        key={dateStr}
        title={holiday || ''}
        style={{
          ...dayCell,
          background: holiday ? '#f3e8ff' : status ? statusBg(status) : (isWeekend ? '#f9fafb' : '#fff'),
          border: isToday ? '2px solid #3b82f6' : holiday ? '1px solid #c084fc' : '1px solid #e2e8f0',
          opacity: isWeekend && !status && !holiday ? 0.6 : 1,
        }}
      >
        <span style={{ fontSize: '0.75rem', color: isToday ? '#1d4ed8' : holiday ? '#7c3aed' : '#64748b' }}>{day}</span>
        {holiday && (
          <span style={{ fontSize: '0.5rem', color: '#7c3aed', fontWeight: 600, marginTop: '1px', textAlign: 'center', lineHeight: '1.1', overflow: 'hidden', maxHeight: '20px' }}>
            {holiday.length > 6 ? holiday.substring(0, 6) + '..' : holiday}
          </span>
        )}
        {status && !holiday && (
          <span style={{ fontSize: '0.6rem', color: statusFg(status), fontWeight: 600, marginTop: '2px' }}>
            {shortStatus(status)}
          </span>
        )}
        {isToday && !status && !holiday && (
          <span style={{ fontSize: '0.55rem', color: '#3b82f6', marginTop: '2px' }}>TODAY</span>
        )}
      </div>
    )
  }

  return cells
}

function LegendItem({ color, textColor, label }: { color: string; textColor: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color, border: '1px solid #e2e8f0' }}></div>
      <span style={{ fontSize: '0.75rem', color: textColor }}>{label}</span>
    </div>
  )
}

function formatStatus(status: string | undefined | null): string {
  if (!status) return 'No record'
  switch (status) {
    case 'Present': return 'Present'
    case 'Absent': return 'Absent'
    case 'Late': return 'Late'
    case 'On_Leave': return 'On Leave'
    default: return status
  }
}

function shortStatus(status: string): string {
  switch (status) {
    case 'Present': return 'P'
    case 'Absent': return 'A'
    case 'Late': return 'L'
    case 'On_Leave': return 'OL'
    default: return '?'
  }
}

function statusBg(status: string | undefined | null): string {
  switch (status) {
    case 'Present': return '#dcfce7'
    case 'Absent': return '#fef2f2'
    case 'Late': return '#fefce8'
    case 'On_Leave': return '#eff6ff'
    default: return '#f8fafc'
  }
}

function statusFg(status: string | undefined | null): string {
  switch (status) {
    case 'Present': return '#16a34a'
    case 'Absent': return '#dc2626'
    case 'Late': return '#d97706'
    case 'On_Leave': return '#2563eb'
    default: return '#94a3b8'
  }
}

const todayBanner: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '1rem 1.25rem', marginBottom: '1.5rem',
}

const statusBadge: React.CSSProperties = {
  padding: '0.3rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 500,
}

const calendarContainer: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem',
}

const calendarHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem',
}

const navBtn: React.CSSProperties = {
  background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px',
  padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.9rem',
}

const calendarGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px',
}

const dayHeader: React.CSSProperties = {
  textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#64748b',
  padding: '0.3rem 0', textTransform: 'uppercase',
}

const dayCell: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '0.4rem', borderRadius: '6px', minHeight: '48px',
}

const emptyCell: React.CSSProperties = { minHeight: '48px' }

const legendStyle: React.CSSProperties = {
  display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center', flexWrap: 'wrap',
}
