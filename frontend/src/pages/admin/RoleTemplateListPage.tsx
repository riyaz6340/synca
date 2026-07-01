import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../api/client'

interface RoleTemplate {
  id: string
  name: string
  permissions: string[]
  organization_id: string
  created_at: string
  updated_at: string
}

export default function RoleTemplateListPage() {
  const [templates, setTemplates] = useState<RoleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const navigate = useNavigate()

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiClient.get('/role-templates')
      setTemplates(res.data.templates ?? [])
    } catch {
      setError('Failed to load role templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  async function handleDelete(template: RoleTemplate) {
    if (!confirm(`Delete role template "${template.name}"?`)) return
    setDeleting(template.id)
    setDeleteError(null)
    try {
      await apiClient.delete(`/role-templates/${template.id}`)
      void fetchTemplates()
    } catch (err: unknown) {
      const data = (err as { response?: { status?: number; data?: { error?: string } } }).response
      if (data?.status === 409) {
        setDeleteError(data.data?.error || 'Cannot delete: template is in use')
      } else {
        setDeleteError(data?.data?.error || 'Failed to delete template')
      }
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <p>Loading role templates...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Role Templates</h1>
        <button onClick={() => navigate('/admin/role-templates/new')} style={btnPrimary}>+ Create Template</button>
      </div>

      {deleteError && (
        <div style={errorBanner}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} style={dismissBtn}>×</button>
        </div>
      )}

      {templates.length === 0 ? (
        <p style={{ color: '#64748b' }}>No role templates found. Create one to get started.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Permissions</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td style={tdStyle} data-label="Name">{t.name}</td>
                <td style={tdStyle} data-label="Permissions">
                  <span style={badgeStyle}>{t.permissions.length} permission{t.permissions.length !== 1 ? 's' : ''}</span>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                    {t.permissions.join(', ')}
                  </div>
                </td>
                <td style={tdStyle} data-label="Actions">
                  <button
                    onClick={() => navigate(`/admin/role-templates/${t.id}/edit`)}
                    style={btnSmall}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void handleDelete(t)}
                    disabled={deleting === t.id}
                    style={{ ...btnSmall, marginLeft: '0.5rem', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    {deleting === t.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSmall: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
const badgeStyle: React.CSSProperties = { background: '#eff6ff', color: '#2563eb', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500 }
const errorBanner: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }
const dismissBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }
