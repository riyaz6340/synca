import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

const ALL_PERMISSIONS = [
  'mark_attendance',
  'view_attendance_reports',
  'create_announcements',
  'publish_announcements',
  'manage_holidays',
  'approve_leave_requests',
  'view_leave_requests',
  'manage_students',
  'manage_groups',
] as const

type Permission = (typeof ALL_PERMISSIONS)[number]

function formatPermissionLabel(permission: string): string {
  return permission
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function RoleTemplateFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEditMode = !!id

  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set())
  const [loading, setLoading] = useState(isEditMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')

  // Fetch existing template in edit mode
  useEffect(() => {
    if (!isEditMode) return

    async function fetchTemplate() {
      try {
        setLoading(true)
        const res = await apiClient.get('/role-templates')
        const templates = res.data.templates ?? []
        const template = templates.find((t: { id: string }) => t.id === id)
        if (template) {
          setName(template.name || '')
          setPermissions(new Set(template.permissions || []))
        } else {
          setError('Role template not found')
        }
      } catch {
        setError('Failed to load role template')
      } finally {
        setLoading(false)
      }
    }

    void fetchTemplate()
  }, [id, isEditMode])

  function validateName(): boolean {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name is required')
      return false
    }
    if (trimmed.length > 100) {
      setNameError('Name must be at most 100 characters')
      return false
    }
    setNameError('')
    return true
  }

  function handlePermissionToggle(permission: Permission) {
    setPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permission)) {
        next.delete(permission)
      } else {
        next.add(permission)
      }
      return next
    })
  }

  async function handleSave() {
    setError('')
    if (!validateName()) return

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        permissions: Array.from(permissions),
      }

      if (isEditMode) {
        await apiClient.put(`/role-templates/${id}`, payload)
      } else {
        await apiClient.post('/role-templates', payload)
      }

      navigate('/admin/role-templates')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } }
      if (axiosErr.response?.status === 409) {
        const msg = axiosErr.response.data?.error || 'Role template name already exists'
        setError(msg)
        setNameError('This name is already in use')
      } else if (axiosErr.response?.data?.error) {
        setError(axiosErr.response.data.error)
      } else {
        setError('Failed to save role template')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    navigate('/admin/role-templates')
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        {isEditMode ? 'Edit Role Template' : 'Create Role Template'}
      </h1>

      {error && (
        <div style={errorBanner}>
          {error}
        </div>
      )}

      <div style={formContainer}>
        {/* Name field */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Template Name *</label>
          <input
            style={nameError ? inputErrorStyle : inputStyle}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError('')
              setError('')
            }}
            placeholder="e.g. Class Teacher, Subject Teacher"
            maxLength={100}
          />
          {nameError && <span style={fieldErrorText}>{nameError}</span>}
          <span style={charCount}>{name.trim().length}/100</span>
        </div>

        {/* Permission checkboxes */}
        <div style={fieldGroup}>
          <label style={labelStyle}>Permissions</label>
          <div style={permissionsGrid}>
            {ALL_PERMISSIONS.map((permission) => (
              <label key={permission} style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={permissions.has(permission)}
                  onChange={() => handlePermissionToggle(permission)}
                  style={checkboxStyle}
                />
                <span>{formatPermissionLabel(permission)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={() => void handleSave()} disabled={saving} style={btnPrimary}>
            {saving ? 'Saving...' : isEditMode ? 'Update Template' : 'Create Template'}
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
  maxWidth: '550px',
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
const charCount: React.CSSProperties = {
  display: 'block',
  marginTop: '0.25rem',
  fontSize: '0.7rem',
  color: '#94a3b8',
  textAlign: 'right',
}
const permissionsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '0.5rem',
  marginTop: '0.5rem',
}
const checkboxLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  color: '#334155',
  cursor: 'pointer',
  padding: '0.4rem 0.5rem',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}
const checkboxStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  cursor: 'pointer',
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
