import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface PersonStatus { presence_status: string; time: string }
interface Person { id: string; name: string; relationship: string; is_active: boolean; roll_number?: string; current_status: PersonStatus | null }
interface AttendanceRecord { id: string; date: string; time: string; presence_status: string }
interface Holiday { date: string; name: string; type: string }

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const fetchPersons = useCallback(async () => {
    try { setLoading(true); const res = await apiClient.get('/portal/persons'); setPersons(res.data.persons ?? []) }
    catch { setError('Failed to load') } finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchPersons() }, [fetchPersons])
  useEffect(() => { if (persons.length > 0 && !selectedPersonId) setSelectedPersonId(persons[0].id) }, [persons, selectedPersonId])

  const fetchMonthAttendance = useCallback(async (personId: string, month: Date) => {
    try {
      setAttendanceLoading(true)
      const y = month.getFullYear(), m = month.getMonth()
      const start = `${y}-${String(m+1).padStart(2,'0')}-01`
      const end = `${y}-${String(m+1).padStart(2,'0')}-${String(new Date(y,m+1,0).getDate()).padStart(2,'0')}`
      const [aRes, hRes] = await Promise.all([
        apiClient.get(`/portal/persons/${personId}/attendance`, { params: { start_date: start, end_date: end } }),
        apiClient.get('/holidays', { params: { year: y, month: m+1 } }),
      ])
      setAttendance(aRes.data.attendance ?? [])
      setHolidays(hRes.data.holidays ?? [])
    } catch { setAttendance([]); setHolidays([]) } finally { setAttendanceLoading(false) }
  }, [])

  useEffect(() => { if (selectedPersonId) void fetchMonthAttendance(selectedPersonId, currentMonth) }, [selectedPersonId, currentMonth, fetchMonthAttendance])

  if (loading) return <div style={loaderStyle}><div style={spinnerStyle}></div><p>Loading...</p></div>
  if (error) return <p style={{ color: 'red', textAlign: 'center', padding: '2rem' }}>{error}</p>

  const selectedPerson = persons.find(p => p.id === selectedPersonId)
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

  // Calculate stats
  const present = attendance.filter(a => a.presence_status === 'Present').length
  const absent = attendance.filter(a => a.presence_status === 'Absent').length
  const late = attendance.filter(a => a.presence_status === 'Late').length
  const onLeave = attendance.filter(a => a.presence_status === 'On_Leave').length
  const total = present + absent + late + onLeave
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header Card */}
      <div style={headerCard}>
        <h1 style={{ fontSize: '1.3rem', margin: '0 0 0.75rem', color: '#fff' }}>My Children</h1>
        {/* Child Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {persons.map((p, i) => (
            <button key={p.id} onClick={() => setSelectedPersonId(p.id)} style={{
              ...childTab,
              background: p.id === selectedPersonId ? '#fff' : 'rgba(255,255,255,0.15)',
              color: p.id === selectedPersonId ? '#4f46e5' : '#fff',
            }}>
              <span style={avatarStyle}>{p.name.charAt(0).toUpperCase()}{getAvatarEmoji(i)}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today's Status */}
      {selectedPerson && (
        <div style={todayCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ ...bigAvatar, background: getGradient(persons.indexOf(selectedPerson)) }}>
              {selectedPerson.name.charAt(0)}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{selectedPerson.name}</h2>
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                {selectedPerson.relationship} • {selectedPerson.roll_number ? `Roll: ${selectedPerson.roll_number}` : ''}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Today</p>
            <span style={{ ...statusPill, ...getStatusStyle(selectedPerson.current_status?.presence_status) }}>
              {getStatusIcon(selectedPerson.current_status?.presence_status)} {formatStatus(selectedPerson.current_status?.presence_status)}
            </span>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {total > 0 && (
        <div style={statsBar}>
          <StatBox label="Present" value={present} color="#10b981" icon="✓" />
          <StatBox label="Absent" value={absent} color="#ef4444" icon="✗" />
          <StatBox label="Late" value={late} color="#f59e0b" icon="⏰" />
          <StatBox label="Leave" value={onLeave} color="#6366f1" icon="📋" />
          <div style={{ ...statBox, borderLeft: '3px solid', borderColor: percentage >= 75 ? '#10b981' : '#ef4444' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: percentage >= 75 ? '#10b981' : '#ef4444' }}>{percentage}%</span>
            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Attendance</span>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div style={calendarCard}>
        <div style={calHeader}>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1, 1))} style={calBtn}>◀</button>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
            {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1, 1))} style={calBtn}>▶</button>
          <button onClick={() => setCurrentMonth(new Date())} style={{ ...calBtn, fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>Today</button>
        </div>

        {attendanceLoading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Loading...</p>
        ) : (
          <>
            <div style={dayHeaderGrid}>
              {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', padding: '0.4rem 0' }}>{d}</div>
              ))}
            </div>
            <div style={dayHeaderGrid}>
              {renderDays(currentMonth, attendance, holidays, todayStr)}
            </div>
          </>
        )}

        <div style={legendBar}>
          <Legend color="#10b981" label="Present" />
          <Legend color="#ef4444" label="Absent" />
          <Legend color="#f59e0b" label="Late" />
          <Legend color="#6366f1" label="Leave" />
          <Legend color="#a78bfa" label="Holiday" />
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={statBox}>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{icon} {value}</span>
      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{label}</span>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color }}></div>
      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{label}</span>
    </div>
  )
}

function renderDays(month: Date, attendance: AttendanceRecord[], holidays: Holiday[], todayStr: string) {
  const y = month.getFullYear(), m = month.getMonth()
  const firstDay = new Date(y, m, 1).getDay()
  const lastDate = new Date(y, m+1, 0).getDate()

  const attMap = new Map<string, string>()
  for (const r of attendance) attMap.set(r.date.split('T')[0], r.presence_status)
  const holMap = new Map<string, string>()
  for (const h of holidays) holMap.set(h.date.split('T')[0], h.name)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`}></div>)

  for (let day = 1; day <= lastDate; day++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const status = attMap.get(ds)
    const holiday = holMap.get(ds)
    const isToday = ds === todayStr
    const isWeekend = new Date(y, m, day).getDay() === 0 || new Date(y, m, day).getDay() === 6

    let bg = '#fff', fg = '#374151', border = '1px solid #f1f5f9'
    if (holiday) { bg = '#ede9fe'; fg = '#7c3aed'; border = '1px solid #c4b5fd' }
    else if (status === 'Present') { bg = '#d1fae5'; fg = '#065f46'; border = '1px solid #6ee7b7' }
    else if (status === 'Absent') { bg = '#fee2e2'; fg = '#991b1b'; border = '1px solid #fca5a5' }
    else if (status === 'Late') { bg = '#fef3c7'; fg = '#92400e'; border = '1px solid #fcd34d' }
    else if (status === 'On_Leave') { bg = '#e0e7ff'; fg = '#3730a3'; border = '1px solid #a5b4fc' }
    else if (isWeekend) { bg = '#f9fafb'; fg = '#9ca3af' }

    if (isToday) border = '2px solid #4f46e5'

    cells.push(
      <div key={ds} title={holiday || status || ''} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        borderRadius: '10px', padding: '0.3rem', minHeight: '52px', background: bg, border,
        cursor: 'default', transition: 'transform 0.1s',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: isToday ? 700 : 500, color: fg }}>{day}</span>
        {status && !holiday && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: fg, marginTop: '1px' }}>{shortStatus(status)}</span>}
        {holiday && <span style={{ fontSize: '0.45rem', fontWeight: 600, color: fg, marginTop: '1px', textAlign: 'center', lineHeight: 1.1 }}>{holiday.length > 5 ? holiday.slice(0,5)+'..' : holiday}</span>}
        {isToday && !status && !holiday && <span style={{ fontSize: '0.5rem', color: '#4f46e5', fontWeight: 700 }}>TODAY</span>}
      </div>
    )
  }
  return cells
}

function formatStatus(s: string | undefined | null) { if (!s) return 'No record'; return s === 'On_Leave' ? 'On Leave' : s }
function shortStatus(s: string) { switch(s) { case 'Present': return '✓ P'; case 'Absent': return '✗ A'; case 'Late': return '⏰ L'; case 'On_Leave': return '📋 OL'; default: return '' } }
function getStatusIcon(s: string | undefined | null) { switch(s) { case 'Present': return '✓'; case 'Absent': return '✗'; case 'Late': return '⏰'; case 'On_Leave': return '📋'; default: return '○' } }
function getStatusStyle(s: string | undefined | null): React.CSSProperties {
  switch(s) {
    case 'Present': return { background: '#d1fae5', color: '#065f46' }
    case 'Absent': return { background: '#fee2e2', color: '#991b1b' }
    case 'Late': return { background: '#fef3c7', color: '#92400e' }
    case 'On_Leave': return { background: '#e0e7ff', color: '#3730a3' }
    default: return { background: '#f1f5f9', color: '#64748b' }
  }
}
function getGradient(i: number) { const g = ['linear-gradient(135deg,#6366f1,#8b5cf6)','linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#10b981,#06b6d4)','linear-gradient(135deg,#ec4899,#8b5cf6)']; return g[i%g.length] }
function getAvatarEmoji(i: number) { const e = ['','','','','']; return e[i%e.length] }

const headerCard: React.CSSProperties = { background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1rem' }
const childTab: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }
const avatarStyle: React.CSSProperties = { fontSize: '0.9rem' }
const todayCard: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
const bigAvatar: React.CSSProperties = { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 700 }
const statusPill: React.CSSProperties = { padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-block', marginTop: '0.2rem' }
const statsBar: React.CSSProperties = { display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto' }
const statBox: React.CSSProperties = { flex: 1, minWidth: '70px', background: '#fff', borderRadius: '10px', padding: '0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
const calendarCard: React.CSSProperties = { background: '#fff', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
const calHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }
const calBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem' }
const dayHeaderGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }
const legendBar: React.CSSProperties = { display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }
const loaderStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' }
const spinnerStyle: React.CSSProperties = { width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTop: '3px solid #4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }
