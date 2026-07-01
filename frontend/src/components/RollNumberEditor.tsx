import { useEffect, useState, useCallback } from 'react'
import apiClient from '../api/client'

interface Member {
  person_id: string
  name: string
  roll_number: number | null
  photo_url: string | null
}

interface RollNumberEditorProps {
  groupId: string
}

interface RowState {
  value: string
  saving: boolean
  error: string
  success: boolean
}

export default function RollNumberEditor({ groupId }: RollNumberEditorProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      setFetchError('')
      const res = await apiClient.get(`/attendance/group/${groupId}/members`)
      const data: Member[] = res.data.members ?? []
      setMembers(data)

      // Initialize row states from current roll numbers
      const initial: Record<string, RowState> = {}
      for (const m of data) {
        initial[m.person_id] = {
          value: m.roll_number != null ? String(m.roll_number) : '',
          saving: false,
          error: '',
          success: false,
        }
      }
      setRowStates(initial)
    } catch {
      setFetchError('Failed to load group members')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    if (groupId) {
      void fetchMembers()
    }
  }, [groupId, fetchMembers])

  /**
   * Validates input: must be empty (to clear) or an integer 1-9999.
   * Also checks for duplicates within the current local state.
   */
  function validate(personId: string, value: string): string {
    if (value.trim() === '') return '' // Allow clearing

    const num = Number(value)
    if (!Number.isInteger(num) || num < 1 || num > 9999) {
      return 'Roll number must be between 1 and 9999'
    }

    // Check for duplicates within current group (local check)
    for (const [pid, state] of Object.entries(rowStates)) {
      if (pid === personId) continue
      if (state.value.trim() !== '' && Number(state.value) === num) {
        const dupMember = members.find(m => m.person_id === pid)
        return `Roll number ${num} is already assigned to ${dupMember?.name ?? 'another student'}`
      }
    }

    return ''
  }

  function handleChange(personId: string, newValue: string) {
    // Only allow digits
    if (newValue !== '' && !/^\d+$/.test(newValue)) return

    setRowStates(prev => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        value: newValue,
        error: '',
        success: false,
      },
    }))
  }

  async function handleSave(personId: string) {
    const state = rowStates[personId]
    if (!state) return

    // Validate before saving
    const validationError = validate(personId, state.value)
    if (validationError) {
      setRowStates(prev => ({
        ...prev,
        [personId]: { ...prev[personId], error: validationError },
      }))
      return
    }

    const rollNumber = state.value.trim() === '' ? null : Number(state.value)

    setRowStates(prev => ({
      ...prev,
      [personId]: { ...prev[personId], saving: true, error: '', success: false },
    }))

    try {
      await apiClient.put(`/groups/${groupId}/members/${personId}/roll-number`, {
        roll_number: rollNumber,
      })
      setRowStates(prev => ({
        ...prev,
        [personId]: { ...prev[personId], saving: false, success: true },
      }))
      // Clear success after 2 seconds
      setTimeout(() => {
        setRowStates(prev => ({
          ...prev,
          [personId]: { ...prev[personId], success: false },
        }))
      }, 2000)
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { error?: string } } }).response
      let errorMsg = 'Failed to save roll number'

      if (response?.status === 409) {
        errorMsg = response.data?.error ?? 'Roll number is already assigned in this group'
      } else if (response?.status === 400) {
        errorMsg = response.data?.error ?? 'Roll number must be between 1 and 9999'
      }

      setRowStates(prev => ({
        ...prev,
        [personId]: { ...prev[personId], saving: false, error: errorMsg },
      }))
    }
  }

  if (loading) return <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading members...</p>
  if (fetchError) return <div style={errorBanner}>{fetchError}</div>
  if (members.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No members in this group.</p>
  }

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Roll Number Assignment</h2>
          <p style={subtitleStyle}>
            Assign roll numbers (1–9999) to students. Roll numbers must be unique within the group.
          </p>
        </div>
        <span style={countBadge}>{members.length} student{members.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Current Roll No.</th>
              <th style={thStyle}>New Roll No.</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => {
              const state = rowStates[member.person_id]
              if (!state) return null

              const hasChanged =
                (member.roll_number == null && state.value.trim() !== '') ||
                (member.roll_number != null && state.value !== String(member.roll_number))

              return (
                <tr key={member.person_id} style={index % 2 === 0 ? rowEvenStyle : undefined}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          style={avatarStyle}
                        />
                      ) : (
                        <div style={avatarPlaceholderStyle}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 500 }}>{member.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {member.roll_number != null ? (
                      <span style={currentRollBadge}>{member.roll_number}</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={state.value}
                      onChange={(e) => handleChange(member.person_id, e.target.value)}
                      placeholder="e.g. 1"
                      disabled={state.saving}
                      style={{
                        ...inputStyle,
                        borderColor: state.error ? '#fca5a5' : '#cbd5e1',
                        background: state.error ? '#fef2f2' : '#fff',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void handleSave(member.person_id)
                        }
                      }}
                    />
                    {state.error && (
                      <div style={rowErrorStyle}>{state.error}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        onClick={() => void handleSave(member.person_id)}
                        disabled={state.saving || !hasChanged}
                        style={{
                          ...btnSave,
                          opacity: state.saving || !hasChanged ? 0.5 : 1,
                          cursor: state.saving || !hasChanged ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {state.saving ? 'Saving...' : 'Save'}
                      </button>
                      {state.success && <span style={successIndicator}>✓</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* Styles matching existing project patterns */
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '1rem',
}

const titleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  margin: '0 0 0.25rem',
  color: '#1e293b',
  fontWeight: 600,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#64748b',
  margin: 0,
}

const countBadge: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.2rem 0.6rem',
  borderRadius: '10px',
  background: '#eff6ff',
  color: '#2563eb',
  border: '1px solid #bfdbfe',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const tableWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  background: '#fff',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.6rem 0.75rem',
  borderBottom: '2px solid #e2e8f0',
  color: '#475569',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  fontWeight: 600,
  background: '#f8fafc',
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
}

const rowEvenStyle: React.CSSProperties = {
  background: '#fafbfc',
}

const inputStyle: React.CSSProperties = {
  width: '80px',
  padding: '0.35rem 0.5rem',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
  textAlign: 'center',
}

const btnSave: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.3rem 0.65rem',
  borderRadius: '4px',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
}

const avatarStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  objectFit: 'cover',
}

const avatarPlaceholderStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  background: '#e2e8f0',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  fontWeight: 600,
}

const currentRollBadge: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.15rem 0.45rem',
  borderRadius: '4px',
  background: '#f1f5f9',
  color: '#334155',
  border: '1px solid #e2e8f0',
  fontWeight: 500,
}

const rowErrorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '0.7rem',
  marginTop: '0.2rem',
  maxWidth: '160px',
}

const successIndicator: React.CSSProperties = {
  color: '#16a34a',
  fontSize: '0.9rem',
  fontWeight: 700,
}

const errorBanner: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#dc2626',
  padding: '0.75rem 1rem',
  borderRadius: '6px',
  marginBottom: '1rem',
  fontSize: '0.85rem',
}
