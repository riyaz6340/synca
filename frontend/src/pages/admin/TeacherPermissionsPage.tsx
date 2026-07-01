import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

/**
 * The 9 granular permissions that can be assigned to a Teacher.
 */
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

/** Human-readable labels for each permission */
const PERMISSION_LABELS: Record<Permission, string> = {
  mark_attendance: 'Mark Attendance',
  view_attendance_reports: 'View Attendance Reports',
  create_announcements: 'Create Announcements',
  publish_announcements: 'Publish Announcements',
  manage_holidays: 'Manage Holidays',
  approve_leave_requests: 'Approve Leave Requests',
  view_leave_requests: 'View Leave Requests',
  manage_students: 'Manage Students',
  manage_groups: 'Manage Groups',
}

interface RoleTemplate {
  id: string
  name: string
  permissions: string[]
}

interface Teacher {
  id: string
  email: string
  role: string
}

export default function TeacherPermissionsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([])
  const [assignedTemplateId, setAssignedTemplateId] = useState<string>('')
  const [directPermissions, setDirectPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  /**
   * Fetches teacher info, role templates, and current permission state.
   */
  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setError('')

      const [teachersRes, templatesRes, permissionsRes] = await Promise.all([
        apiClient.get(`/teachers`),
        apiClient.get('/role-templates'),
        apiClient.get(`/teachers/${id}/permissions`),
      ])

      // Find the specific teacher
      const teachers = teachersRes.data.teachers ?? []
      const found = teachers.find((t: Teacher) => t.id === id)
      setTeacher(found || null)

      // Set available role templates
      setRoleTemplates(templatesRes.data.templates ?? [])

      // Set current assigned template and direct permissions
      const permData = permissionsRes.data
      setAssignedTemplateId(permData.template_id || '')
      setDirectPermissions(new Set(permData.direct_permissions ?? []))
    } catch {
      setError('Failed to load teacher permission data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  /**
   * Gets the permissions from the currently selected role template.
   */
  function getTemplatePermissions(): Set<string> {
    if (!assignedTemplateId) return new Set()
    const template = roleTemplates.find((t) => t.id === assignedTemplateId)
    return new Set(template?.permissions ?? [])
  }

  /**
   * Computes effective permissions as the union of template + direct permissions.
   */
  function getEffectivePermissions(): Set<string> {
    const templatePerms = getTemplatePermissions()
    return new Set([...templatePerms, ...directPermissions])
  }

  /**
   * Handles role template assignment change.
   */
  async function handleTemplateChange(templateId: string) {
    setAssignedTemplateId(templateId)
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await apiClient.put(`/teachers/${id}/role-template`, {
        template_id: templateId || null,
      })
      setSuccess('Role template updated successfully')
    } catch {
      setError('Failed to update role template')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Handles toggling an individual direct permission.
   */
  function handlePermissionToggle(permission: Permission) {
    setDirectPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permission)) {
        next.delete(permission)
      } else {
        next.add(permission)
      }
      return next
    })
  }

  /**
   * Saves the direct permissions to the backend.
   */
  async function handleSavePermissions() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await apiClient.put(`/teachers/${id}/permissions`, {
        permissions: Array.from(directPermissions),
      })
      setSuccess('Permissions saved successfully')
    } catch {
      setError('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading permissions...</p>
  if (!teacher) return <p style={{ color: 'red' }}>Teacher not found</p>

  const templatePermissions = getTemplatePermissions()
  const effectivePermissions = getEffectivePermissions()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Permissions</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            {teacher.email}
          </p>
        </div>
        <button onClick={() => navigate(-1)} style={btnSecondary}>← Back</button>
      </div>

      {/* Status Messages */}
      {error && <div style={errorBanner}>{error}</div>}
      {success && <div style={successBanner}>{success}</div>}

      {/* Role Template Section */}
      <section style={sectionStyle}>
        <h2 style={sectionTitle}>Role Template</h2>
        <p style={sectionDesc}>
          Assign a role template to grant a preset bundle of permissions. The teacher will inherit all permissions from the selected template.
        </p>
        <select
          value={assignedTemplateId}
          onChange={(e) => void handleTemplateChange(e.target.value)}
          disabled={saving}
          style={selectStyle}
          aria-label="Role Template"
        >
          <option value="">— No template —</option>
          {roleTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.permissions.length} permissions)
            </option>
          ))}
        </select>

        {assignedTemplateId && (
          <div style={{ marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>Template grants:</span>
            <div style={chipContainer}>
              {Array.from(templatePermissions).map((p) => (
                <span key={p} style={chipTemplate}>
                  {PERMISSION_LABELS[p as Permission] || p}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Direct Permissions Section */}
      <section style={sectionStyle}>
        <h2 style={sectionTitle}>Direct Permissions</h2>
        <p style={sectionDesc}>
          Assign individual permissions directly to this teacher. These are combined with template permissions to form the effective permission set.
        </p>
        <div style={checkboxGrid}>
          {ALL_PERMISSIONS.map((permission) => (
            <label key={permission} style={checkboxLabel}>
              <input
                type="checkbox"
                checked={directPermissions.has(permission)}
                onChange={() => handlePermissionToggle(permission)}
                disabled={saving}
                style={checkboxInput}
              />
              <span>{PERMISSION_LABELS[permission]}</span>
            </label>
          ))}
        </div>
        <button
          onClick={() => void handleSavePermissions()}
          disabled={saving}
          style={{ ...btnPrimary, marginTop: '1rem' }}
        >
          {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </section>

      {/* Effective Permissions Section */}
      <section style={sectionStyle}>
        <h2 style={sectionTitle}>Effective Permissions</h2>
        <p style={sectionDesc}>
          The final set of permissions this teacher has — computed as the union of template permissions and direct permissions.
        </p>
        {effectivePermissions.size === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No permissions granted.</p>
        ) : (
          <div style={checkboxGrid}>
            {ALL_PERMISSIONS.map((permission) => {
              const hasIt = effectivePermissions.has(permission)
              const fromTemplate = templatePermissions.has(permission)
              const fromDirect = directPermissions.has(permission)
              return (
                <div key={permission} style={effectiveRow}>
                  <span style={{ color: hasIt ? '#16a34a' : '#94a3b8', marginRight: '0.5rem' }}>
                    {hasIt ? '✓' : '✗'}
                  </span>
                  <span style={{ color: hasIt ? '#1e293b' : '#94a3b8' }}>
                    {PERMISSION_LABELS[permission]}
                  </span>
                  {hasIt && (
                    <span style={sourceTag}>
                      {fromTemplate && fromDirect
                        ? 'template + direct'
                        : fromTemplate
                        ? 'template'
                        : 'direct'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

/* Styles matching the project's existing inline style patterns */
const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSecondary: React.CSSProperties = { background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const sectionStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }
const sectionTitle: React.CSSProperties = { fontSize: '1.1rem', margin: '0 0 0.25rem', color: '#1e293b' }
const sectionDesc: React.CSSProperties = { fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem' }
const selectStyle: React.CSSProperties = { width: '100%', maxWidth: '400px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box' }
const checkboxGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }
const checkboxLabel: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#334155', cursor: 'pointer', padding: '0.4rem 0' }
const checkboxInput: React.CSSProperties = { width: '16px', height: '16px', cursor: 'pointer' }
const effectiveRow: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: '0.85rem', padding: '0.35rem 0' }
const sourceTag: React.CSSProperties = { marginLeft: '0.5rem', fontSize: '0.7rem', background: '#f1f5f9', color: '#64748b', padding: '0.15rem 0.4rem', borderRadius: '3px' }
const chipContainer: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }
const chipTemplate: React.CSSProperties = { fontSize: '0.75rem', background: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe' }
const errorBanner: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }
const successBanner: React.CSSProperties = { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }
