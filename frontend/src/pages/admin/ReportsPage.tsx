import { useState, useEffect, useCallback, useRef } from 'react'
import apiClient from '../../api/client'

interface Group { id: string; name: string }
interface Person { id: string; name: string; roll_number?: string }

interface ReportRow {
  personId: string
  personName: string
  daysPresent: number
  daysAbsent: number
  daysLate: number
  daysOnLeave: number
  attendancePercentage: number
}

interface ReportSummary {
  daysPresent: number
  daysAbsent: number
  daysLate: number
  daysOnLeave: number
  attendancePercentage: number
}

type ReportType = 'class' | 'student' | 'organization'

export default function ReportsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reportType, setReportType] = useState<ReportType>('class')
  const [groupId, setGroupId] = useState('')
  const [personId, setPersonId] = useState('')
  const [results, setResults] = useState<ReportRow[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [totalDays, setTotalDays] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Searchable dropdowns
  const [groupSearch, setGroupSearch] = useState('')
  const [personSearch, setPersonSearch] = useState('')
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [showPersonDropdown, setShowPersonDropdown] = useState(false)
  const groupRef = useRef<HTMLDivElement>(null)
  const personRef = useRef<HTMLDivElement>(null)

  const fetchFilters = useCallback(async () => {
    try {
      const [groupsRes, personsRes] = await Promise.all([
        apiClient.get('/groups'),
        apiClient.get('/persons?limit=100'),
      ])
      setGroups(groupsRes.data.groups ?? [])
      setPersons(personsRes.data.data ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void fetchFilters() }, [fetchFilters])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setShowGroupDropdown(false)
      if (personRef.current && !personRef.current.contains(e.target as Node)) setShowPersonDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectGroup(g: Group) {
    setGroupId(g.id)
    setGroupSearch(g.name)
    setShowGroupDropdown(false)
  }

  function selectPerson(p: Person) {
    setPersonId(p.id)
    setPersonSearch(`${p.name}${p.roll_number ? ` (${p.roll_number})` : ''}`)
    setShowPersonDropdown(false)
  }

  function clearGroup() { setGroupId(''); setGroupSearch('') }
  function clearPerson() { setPersonId(''); setPersonSearch('') }

  async function generateReport() {
    if (!startDate || !endDate) { setError('Please select both start and end dates'); return }
    setLoading(true); setError('')
    try {
      const params: Record<string, string> = { start_date: startDate, end_date: endDate }
      if (reportType === 'class' && groupId) params.group_id = groupId
      if (reportType === 'student' && personId) params.person_id = personId
      const res = await apiClient.get('/reports/attendance', { params })
      const report = res.data.report
      setResults(report?.persons ?? [])
      setSummary(report?.summary ?? null)
      setTotalDays(report?.totalDays ?? 0)
    } catch { setError('Failed to generate report') }
    finally { setLoading(false) }
  }

  function handleExport(format: 'pdf' | 'csv') {
    const params = new URLSearchParams()
    params.set('format', format)
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    if (groupId) params.set('group_id', groupId)
    if (personId) params.set('person_id', personId)
    const token = localStorage.getItem('token')
    window.open(`http://localhost:3000/api/reports/attendance/export?${params.toString()}&token=${token ?? ''}`, '_blank')
  }

  const filteredGroups = groups.filter(g => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
  const filteredPersons = persons.filter(p => {
    if (!personSearch) return true
    const q = personSearch.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.roll_number && p.roll_number.toLowerCase().includes(q))
  })

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Attendance Reports</h1>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Generate class-wise, student-wise, or organization-wide attendance reports.</p>

      {/* Report Type Tabs */}
      <div className="scroll-x-mobile" style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '3px', marginBottom: '1.5rem', width: 'fit-content' }}>
        {([['class', '🏫 Class Report'], ['student', '👤 Student Report'], ['organization', '🏢 School Report']] as [ReportType, string][]).map(([type, label]) => (
          <button key={type} onClick={() => { setReportType(type); setResults([]); setSummary(null) }}
            style={{ ...tabBtn, background: reportType === type ? '#fff' : 'transparent', color: reportType === type ? '#1e293b' : '#64748b', boxShadow: reportType === type ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Start Date *</label>
            <input style={inputStyle} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>End Date *</label>
            <input style={inputStyle} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          {/* Class searchable dropdown */}
          {reportType === 'class' && (
            <div style={{ position: 'relative', minWidth: '200px' }} ref={groupRef}>
              <label style={labelStyle}>Class *</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input style={inputStyle} placeholder="Search class..." value={groupSearch}
                  onChange={e => { setGroupSearch(e.target.value); setGroupId(''); setShowGroupDropdown(true) }}
                  onFocus={() => setShowGroupDropdown(true)} />
                {groupId && <button onClick={clearGroup} style={clearBtn}>✕</button>}
              </div>
              {showGroupDropdown && (
                <div style={dropdownStyle}>
                  {filteredGroups.map(g => (
                    <div key={g.id} onClick={() => selectGroup(g)} style={dropdownItem}>{g.name}</div>
                  ))}
                  {filteredGroups.length === 0 && <div style={{ padding: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>No classes found</div>}
                </div>
              )}
            </div>
          )}

          {/* Student searchable dropdown */}
          {reportType === 'student' && (
            <div style={{ position: 'relative', minWidth: '220px' }} ref={personRef}>
              <label style={labelStyle}>Student *</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input style={inputStyle} placeholder="Search by name or roll..." value={personSearch}
                  onChange={e => { setPersonSearch(e.target.value); setPersonId(''); setShowPersonDropdown(true) }}
                  onFocus={() => setShowPersonDropdown(true)} />
                {personId && <button onClick={clearPerson} style={clearBtn}>✕</button>}
              </div>
              {showPersonDropdown && (
                <div style={dropdownStyle}>
                  {filteredPersons.slice(0, 15).map(p => (
                    <div key={p.id} onClick={() => selectPerson(p)} style={dropdownItem}>
                      <strong>{p.name}</strong>
                      {p.roll_number && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>Roll: {p.roll_number}</span>}
                    </div>
                  ))}
                  {filteredPersons.length === 0 && <div style={{ padding: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>No students found</div>}
                </div>
              )}
            </div>
          )}

          <button onClick={() => void generateReport()} style={btnPrimary} disabled={loading}>
            {loading ? 'Generating...' : '📊 Generate Report'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>}

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <SummaryCard label="Total Working Days" value={totalDays} color="#6366f1" />
          <SummaryCard label="Total Present" value={summary.daysPresent} color="#16a34a" />
          <SummaryCard label="Total Absent" value={summary.daysAbsent} color="#dc2626" />
          <SummaryCard label="Total Late" value={summary.daysLate} color="#d97706" />
          <SummaryCard label="On Leave" value={summary.daysOnLeave} color="#2563eb" />
          <SummaryCard label="Overall %" value={`${summary.attendancePercentage}%`} color="#8b5cf6" />
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
              {reportType === 'class' ? `Class Report — ${groupSearch || 'All'}` : reportType === 'student' ? `Student Report — ${personSearch}` : 'Organization Report'}
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.75rem' }}>{results.length} students</span>
            </h3>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => handleExport('csv')} style={exportBtn}>📄 CSV</button>
              <button onClick={() => handleExport('pdf')} style={exportBtn}>📑 PDF</button>
            </div>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Student Name</th>
                <th style={{ ...thStyle, color: '#16a34a' }}>Present</th>
                <th style={{ ...thStyle, color: '#dc2626' }}>Absent</th>
                <th style={{ ...thStyle, color: '#d97706' }}>Late</th>
                <th style={{ ...thStyle, color: '#2563eb' }}>Leave</th>
                <th style={thStyle}>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.personId} style={{ background: r.attendancePercentage < 75 ? '#fef2f2' : 'transparent' }}>
                  <td style={tdStyle} data-label="#">{i + 1}</td>
                  <td style={tdStyle} data-label="Student Name"><strong>{r.personName}</strong></td>
                  <td style={{ ...tdStyle, color: '#16a34a', fontWeight: 600 }} data-label="Present">{r.daysPresent}</td>
                  <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 600 }} data-label="Absent">{r.daysAbsent}</td>
                  <td style={{ ...tdStyle, color: '#d97706', fontWeight: 600 }} data-label="Late">{r.daysLate}</td>
                  <td style={{ ...tdStyle, color: '#2563eb' }} data-label="Leave">{r.daysOnLeave}</td>
                  <td style={tdStyle} data-label="Attendance %">
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, background: r.attendancePercentage >= 90 ? '#dcfce7' : r.attendancePercentage >= 75 ? '#fefce8' : '#fef2f2', color: r.attendancePercentage >= 90 ? '#16a34a' : r.attendancePercentage >= 75 ? '#d97706' : '#dc2626' }}>
                      {r.attendancePercentage?.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Low Attendance Warning */}
          {results.filter(r => r.attendancePercentage < 75).length > 0 && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#dc2626', background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
              ⚠️ {results.filter(r => r.attendancePercentage < 75).length} student(s) have attendance below 75% (highlighted in red)
            </p>
          )}
        </div>
      )}

      {results.length === 0 && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</p>
          <p>Select report type, date range, and click Generate Report</p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `4px solid ${color}`, borderRadius: '8px', padding: '0.75rem' }}>
      <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>{value}</p>
    </div>
  )
}

const tabBtn: React.CSSProperties = { border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }
const inputStyle: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }
const exportBtn: React.CSSProperties = { background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.35rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
const clearBtn: React.CSSProperties = { background: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '0 0.4rem', color: '#dc2626', fontSize: '0.8rem' }
const dropdownStyle: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '2px', maxHeight: '180px', overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
const dropdownItem: React.CSSProperties = { padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.6rem 0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
