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
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 404) {
        setError('Role Templates feature requires backend update. Please redeploy to Render.')
      } else {
        setError('Failed to load role templates')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  // Scroll to top when page loads (fixes mobile scroll position after navigation)
  useEffect(() => {
    window.scrollTo(0, 0)
    const mainEl = document.querySelector('.admin-main')
    if (mainEl) mainEl.scrollTop = 0
  }, [])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>🔑 Role Templates</h1>
        <button onClick={() => navigate('/admin/role-templates/new')} style={btnPrimary}>+ Create Template</button>
      </div>

      {deleteError && (
        <div style={errorBanner}>
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} style={dismissBtn}>×</button>
        </div>
      )}

      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔑</div>
          <h2 style={{ fontSize: '1.1rem', color: '#475569', margin: '0 0 0.5rem' }}>No Role Templates</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Create a role template to define permission sets for teachers.
          </p>
          <button onClick={() => navigate('/admin/role-templates/new')} style={btnPrimary}>+ Create Template</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {templates.map((t) => (
            <div key={t.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>{t.name}</strong>
                  <div style={{ marginTop: '0.3rem' }}>
                    <span style={badgeStyle}>{t.permissions.length} permission{t.permissions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>
                    {t.permissions.join(', ')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => navigate(`/admin/role-templates/${t.id}/edit`)} style={actionBtn}>✏️ Edit</button>
                <button
                  onClick={() => void handleDelete(t)}
                  disabled={deleting === t.id}
                  style={{ ...actionBtn, color: '#dc2626' }}
                >
                  {deleting === t.id ? '⏳ Deleting...' : '🗑 Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile floating create button - always visible */}
      <div style={{ position: 'sticky', bottom: '0', padding: '0.75rem 0', background: 'linear-gradient(transparent, #f8fafc 30%)', marginTop: '1rem' }}>
        <button onClick={() => navigate('/admin/role-templates/new')} style={{ ...btnPrimary, width: '100%', padding: '0.75rem' }}>+ Create Template</button>
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem' }
const actionBtn: React.CSSProperties = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.3rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', color: '#475569' }
const badgeStyle: React.CSSProperties = { background: '#eff6ff', color: '#2563eb', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500 }
const errorBanner: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }
const dismissBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.25rem' }
