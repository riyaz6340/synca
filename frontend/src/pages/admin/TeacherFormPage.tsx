import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

interface TeacherForm {
  email: string
  password: string
  name: string
}

const emptyForm: TeacherForm = {
  email: '',
  password: '',
  name: '',
}

/**
 * RFC 5322 simplified email regex.
 * Matches common valid email formats while rejecting clearly invalid ones.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required'
  if (email.trim().length > 254) return 'Email must be at most 254 characters'
  if (!EMAIL_REGEX.test(email.trim())) return 'Invalid email format'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export default function TeacherFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [form, setForm] = useState<TeacherForm>(emptyForm)
  const [loading, setLoading] = useState(isEditMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof TeacherForm, string>>>({})

  // Fetch existing teacher data in edit mode
  useEffect(() => {
    if (!isEditMode) return

    async function fetchTeacher() {
      try {
        setLoading(true)
        const res = await apiClient.get(`/teachers/${id}`)
        const teacher = res.data.teacher ?? res.data
        setForm({
          email: teacher.email || '',
          password: '',
          name: teacher.name || '',
        })
      } catch {
        setError('Failed to load teacher data')
      } finally {
        setLoading(false)
      }
    }

    void fetchTeacher()
  }, [id, isEditMode])

  function validate(): boolean {
    const errors: Partial<Record<keyof TeacherForm, string>> = {}

    const emailErr = validateEmail(form.email)
    if (emailErr) errors.email = emailErr

    // Password is required for create, optional for edit
    if (!isEditMode) {
      const pwErr = validatePassword(form.password)
      if (pwErr) errors.password = pwErr
    } else if (form.password && form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave() {
    setError('')
    if (!validate()) return

    setSaving(true)
    try {
      const payload: Record<string, string> = {
        email: form.email.trim(),
      }

      if (form.name.trim()) {
        payload.name = form.name.trim()
      }

      if (!isEditMode) {
        // Create mode: password required
        payload.password = form.password
        await apiClient.post('/teachers', payload)
      } else {
        // Edit mode: password optional
        if (form.password) {
          payload.password = form.password
        }
        await apiClient.put(`/teachers/${id}`, payload)
      }

      // Navigate back to teacher list on success
      navigate('/admin/teachers')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } }
      if (axiosErr.response?.status === 409) {
        setError(axiosErr.response.data?.error || 'Email already in use in this organization')
        setFieldErrors({ email: 'This email is already in use' })
      } else if (axiosErr.response?.data?.error) {
        setError(axiosErr.response.data.error)
      } else {
        setError('Failed to save teacher')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    navigate('/admin/teachers')
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        {isEditMode ? 'Edit Teacher' : 'Create Teacher'}
      </h1>

      {error && (
        <div style={errorBanner}>
          {error}
        </div>
      )}

      <div style={formContainer}>
        {/* Name field */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Name</label>
          <input
            style={fieldErrors.name ? inputErrorStyle : inputStyle}
            type="text"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value })
              setFieldErrors({ ...fieldErrors, name: undefined })
            }}
            placeholder="Teacher's full name"
          />
          {fieldErrors.name && <span style={fieldErrorText}>{fieldErrors.name}</span>}
        </div>

        {/* Email field */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Email *</label>
          <input
            style={fieldErrors.email ? inputErrorStyle : inputStyle}
            type="email"
            value={form.email}
            onChange={(e) => {
              setForm({ ...form, email: e.target.value })
              setFieldErrors({ ...fieldErrors, email: undefined })
              setError('')
            }}
            placeholder="teacher@school.com"
          />
          {fieldErrors.email && <span style={fieldErrorText}>{fieldErrors.email}</span>}
        </div>

        {/* Password field */}
        <div style={fieldGroup}>
          <label style={labelStyle}>
            Password {isEditMode ? '(leave blank to keep current)' : '*'}
          </label>
          <input
            style={fieldErrors.password ? inputErrorStyle : inputStyle}
            type="password"
            value={form.password}
            onChange={(e) => {
              setForm({ ...form, password: e.target.value })
              setFieldErrors({ ...fieldErrors, password: undefined })
            }}
            placeholder={isEditMode ? 'Enter new password to change' : 'Minimum 8 characters'}
          />
          {fieldErrors.password && <span style={fieldErrorText}>{fieldErrors.password}</span>}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={() => void handleSave()} disabled={saving} style={btnPrimary}>
            {saving ? 'Saving...' : isEditMode ? 'Update Teacher' : 'Create Teacher'}
          </button>
          <button onClick={handleCancel} style={btnSecondary}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// Styles
const formContainer: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '1.5rem',
  maxWidth: '500px',
}
const fieldGroup: React.CSSProperties = {
  marginBottom: '1rem',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.3rem',
  fontSize: '0.8rem',
  color: '#475569',
  fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.6rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
}
const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1px solid #ef4444',
}
const fieldErrorText: React.CSSProperties = {
  display: 'block',
  marginTop: '0.25rem',
  fontSize: '0.75rem',
  color: '#ef4444',
}
const errorBanner: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  marginBottom: '1rem',
  fontSize: '0.85rem',
}
const btnPrimary: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '0.5rem 1.25rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: 500,
}
const btnSecondary: React.CSSProperties = {
  background: '#e2e8f0',
  color: '#334155',
  border: 'none',
  padding: '0.5rem 1.25rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.9rem',
}
