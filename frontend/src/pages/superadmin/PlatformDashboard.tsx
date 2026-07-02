import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import AnalyticsDashboardWidget from '../../components/AnalyticsDashboardWidget'

interface Overview {
  total_organizations: number
  total_persons: number
  total_users: number
  total_attendance_records: number
  monthly_revenue: number
}

interface PlanBreakdown {
  plan: string
  count: number
}

interface IndustryBreakdown {
  industry_module: string
  count: number
}

interface BillingBreakdown {
  billing_status: string
  count: number
}

interface TodayAttendance {
  presence_status: string
  count: number
}

interface Organization {
  id: string
  name: string
  industry_module: string
  plan: string
  monthly_amount: number
  billing_status: string
  person_count: number
  created_at: string
}

interface DashboardData {
  overview: Overview
  plan_breakdown: PlanBreakdown[]
  industry_breakdown: IndustryBreakdown[]
  billing_breakdown: BillingBreakdown[]
  today_attendance: TodayAttendance[]
  recent_organizations: Organization[]
  organizations_by_size: Organization[]
}

export default function PlatformDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  const [editForm, setEditForm] = useState({ plan: '', monthly_amount: '', billing_status: '' })
  const [saving, setSaving] = useState(false)
  const [showAddOrg, setShowAddOrg] = useState(false)
  const [addOrgForm, setAddOrgForm] = useState({ name: '', industry_module: 'school', plan: 'free', admin_email: '', admin_password: '' })
  const [addingOrg, setAddingOrg] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await apiClient.get('/super-admin/dashboard')
      setData(res.data)
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } }).response?.status
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      if (status === 403) {
        setError('Access denied. SuperAdmin role required.')
      } else if (status === 401) {
        setError('Session expired. Please login again.')
      } else {
        setError(message || 'Failed to load dashboard data. Please retry.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchOrganizations = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '50' }
      if (search) params.search = search
      if (planFilter) params.plan = planFilter
      const res = await apiClient.get('/super-admin/organizations', { params })
      setOrganizations(res.data.data ?? [])
    } catch {
      // ignore
    }
  }, [search, planFilter])

  useEffect(() => {
    void fetchDashboard()
    void fetchOrganizations()
  }, [fetchDashboard, fetchOrganizations])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function openEditModal(org: Organization) {
    setEditingOrg(org)
    setEditForm({
      plan: org.plan || 'free',
      monthly_amount: String(org.monthly_amount || 0),
      billing_status: org.billing_status || 'active',
    })
  }

  async function handleSavePlan() {
    if (!editingOrg) return
    setSaving(true)
    try {
      await apiClient.put(`/super-admin/organizations/${editingOrg.id}/plan`, {
        plan: editForm.plan,
        monthly_amount: parseFloat(editForm.monthly_amount) || 0,
        billing_status: editForm.billing_status,
      })
      setEditingOrg(null)
      void fetchDashboard()
      void fetchOrganizations()
    } catch {
      alert('Failed to update organization plan')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddOrg() {
    if (!addOrgForm.name || !addOrgForm.admin_email || !addOrgForm.admin_password) {
      alert('Please fill in all required fields')
      return
    }
    setAddingOrg(true)
    try {
      await apiClient.post('/super-admin/organizations', addOrgForm)
      setShowAddOrg(false)
      setAddOrgForm({ name: '', industry_module: 'school', plan: 'free', admin_email: '', admin_password: '' })
      void fetchDashboard()
      void fetchOrganizations()
      alert('Organization created successfully!')
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to create organization'
      alert(message)
    } finally {
      setAddingOrg(false)
    }
  }

  if (loading) return <div style={pageStyle}><p>Loading platform dashboard...</p></div>
  if (error) return <div style={pageStyle}><p style={{ color: '#dc2626' }}>{error}</p><button onClick={() => void fetchDashboard()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retry</button></div>
  if (!data) return <div style={pageStyle}><p style={{ color: '#dc2626' }}>Dashboard data unavailable. The API may be starting up (Render cold start). Please wait and refresh.</p><button onClick={() => void fetchDashboard()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retry</button></div>

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0, color: '#1e293b' }}>Arixx Platform Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>Founder &amp; Super Admin View</p>
        </div>
        <button onClick={() => void handleLogout()} style={logoutBtn}>Logout</button>
      </div>

      {/* Key Metrics */}
      <div style={gridStyle}>
        <MetricCard label="Total Organizations" value={data.overview.total_organizations} color="#3b82f6" />
        <MetricCard label="Total Students/Persons" value={data.overview.total_persons} color="#10b981" />
        <MetricCard label="Total Users" value={data.overview.total_users} color="#8b5cf6" />
        <MetricCard label="Monthly Revenue" value={`₹${data.overview.monthly_revenue.toLocaleString()}`} color="#f59e0b" />
        <MetricCard label="Attendance Records" value={data.overview.total_attendance_records.toLocaleString()} color="#6366f1" />
      </div>

      {/* User Activity Analytics */}
      <AnalyticsDashboardWidget />

      {/* Breakdown Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Plan Breakdown */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>Organizations by Plan</h3>
          {data.plan_breakdown.length === 0 ? (
            <p style={emptyText}>No data</p>
          ) : (
            <table style={miniTable}>
              <tbody>
                {data.plan_breakdown.map(p => (
                  <tr key={p.plan}>
                    <td style={miniTd}><span style={{ ...planBadge, background: planColor(p.plan) }}>{p.plan || 'free'}</span></td>
                    <td style={{ ...miniTd, textAlign: 'right', fontWeight: 600 }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Industry Breakdown */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>By Industry</h3>
          {data.industry_breakdown.length === 0 ? (
            <p style={emptyText}>No data</p>
          ) : (
            <table style={miniTable}>
              <tbody>
                {data.industry_breakdown.map(i => (
                  <tr key={i.industry_module}>
                    <td style={miniTd}>{i.industry_module}</td>
                    <td style={{ ...miniTd, textAlign: 'right', fontWeight: 600 }}>{i.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Billing Status */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>Billing Status</h3>
          {data.billing_breakdown.length === 0 ? (
            <p style={emptyText}>No data</p>
          ) : (
            <table style={miniTable}>
              <tbody>
                {data.billing_breakdown.map(b => (
                  <tr key={b.billing_status}>
                    <td style={miniTd}><span style={{ color: billingColor(b.billing_status) }}>{b.billing_status}</span></td>
                    <td style={{ ...miniTd, textAlign: 'right', fontWeight: 600 }}>{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Today's Attendance */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>Today&apos;s Attendance (All Orgs)</h3>
          {data.today_attendance.length === 0 ? (
            <p style={emptyText}>No attendance marked today</p>
          ) : (
            <table style={miniTable}>
              <tbody>
                {data.today_attendance.map(a => (
                  <tr key={a.presence_status}>
                    <td style={miniTd}>{a.presence_status}</td>
                    <td style={{ ...miniTd, textAlign: 'right', fontWeight: 600 }}>{a.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Organizations Table */}
      <div style={{ ...cardStyle, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ ...cardTitle, marginBottom: 0 }}>All Organizations</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowAddOrg(true)} style={addOrgBtn}>+ Add Organization</button>
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={inputStyle}
            />
            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={inputStyle}>
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Organization</th>
              <th style={thStyle}>Industry</th>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Monthly ₹</th>
              <th style={thStyle}>Students</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Joined</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map(org => (
              <tr key={org.id}>
                <td style={tdStyle}><strong>{org.name}</strong></td>
                <td style={tdStyle}>{org.industry_module}</td>
                <td style={tdStyle}><span style={{ ...planBadge, background: planColor(org.plan) }}>{org.plan || 'free'}</span></td>
                <td style={tdStyle}>₹{org.monthly_amount || 0}</td>
                <td style={tdStyle}>{org.person_count}</td>
                <td style={tdStyle}><span style={{ color: billingColor(org.billing_status) }}>{org.billing_status}</span></td>
                <td style={tdStyle}>{new Date(org.created_at).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <button onClick={() => openEditModal(org)} style={editBtn}>Edit Plan</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {organizations.length === 0 && (
          <p style={{ ...emptyText, marginTop: '1rem' }}>No organizations found.</p>
        )}
      </div>

      {/* Top Organizations by Size */}
      <div style={cardStyle}>
        <h3 style={cardTitle}>Top Organizations by Size</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Organization</th>
              <th style={thStyle}>Students</th>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Revenue</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.organizations_by_size.map(org => (
              <tr key={org.id || org.org_id}>
                <td style={tdStyle}><strong>{org.name || (org as unknown as { org_name: string }).org_name}</strong></td>
                <td style={tdStyle}>{org.person_count}</td>
                <td style={tdStyle}><span style={{ ...planBadge, background: planColor(org.plan) }}>{org.plan || 'free'}</span></td>
                <td style={tdStyle}>₹{org.monthly_amount || 0}/mo</td>
                <td style={tdStyle}><span style={{ color: billingColor(org.billing_status) }}>{org.billing_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Plan Modal */}
      {editingOrg && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0, fontSize: '1.2rem', color: '#1e293b' }}>
              Edit Plan: {editingOrg.name}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              {editingOrg.person_count} students • Joined {new Date(editingOrg.created_at).toLocaleDateString()}
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Plan</label>
              <select
                value={editForm.plan}
                onChange={e => setEditForm({ ...editForm, plan: e.target.value })}
                style={modalInputStyle}
              >
                <option value="free">Free</option>
                <option value="starter">Starter (₹3/student/mo)</option>
                <option value="growth">Growth (₹5/student/mo)</option>
                <option value="premium">Premium (₹8/student/mo)</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Monthly Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={editForm.monthly_amount}
                onChange={e => setEditForm({ ...editForm, monthly_amount: e.target.value })}
                style={modalInputStyle}
                placeholder="0"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Billing Status</label>
              <select
                value={editForm.billing_status}
                onChange={e => setEditForm({ ...editForm, billing_status: e.target.value })}
                style={modalInputStyle}
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => void handleSavePlan()}
                disabled={saving}
                style={{ ...saveBtnStyle, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingOrg(null)} style={cancelBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Organization Modal */}
      {showAddOrg && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0, fontSize: '1.2rem', color: '#1e293b' }}>
              Onboard New Organization
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
              This creates the organization and its first admin account.
            </p>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Organization / Institution Name *</label>
              <input
                type="text"
                value={addOrgForm.name}
                onChange={e => setAddOrgForm({ ...addOrgForm, name: e.target.value })}
                style={modalInputStyle}
                placeholder="e.g. Springfield Public School"
              />
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Industry</label>
              <select
                value={addOrgForm.industry_module}
                onChange={e => setAddOrgForm({ ...addOrgForm, industry_module: e.target.value })}
                style={modalInputStyle}
              >
                <option value="school">School</option>
                <option value="hospital">Hospital</option>
                <option value="security">Security Agency</option>
                <option value="apartment">Apartment</option>
                <option value="workforce">Workforce / Office</option>
              </select>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Plan</label>
              <select
                value={addOrgForm.plan}
                onChange={e => setAddOrgForm({ ...addOrgForm, plan: e.target.value })}
                style={modalInputStyle}
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '1rem 0' }} />
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.75rem' }}>Admin Account (institution will use this to login)</p>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Admin Email *</label>
              <input
                type="email"
                value={addOrgForm.admin_email}
                onChange={e => setAddOrgForm({ ...addOrgForm, admin_email: e.target.value })}
                style={modalInputStyle}
                placeholder="admin@school.com"
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Admin Password *</label>
              <input
                type="text"
                value={addOrgForm.admin_password}
                onChange={e => setAddOrgForm({ ...addOrgForm, admin_password: e.target.value })}
                style={modalInputStyle}
                placeholder="Create a strong password"
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => void handleAddOrg()}
                disabled={addingOrg}
                style={{ ...saveBtnStyle, background: '#10b981', opacity: addingOrg ? 0.7 : 1 }}
              >
                {addingOrg ? 'Creating...' : 'Create Organization'}
              </button>
              <button onClick={() => setShowAddOrg(false)} style={cancelBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ ...metricCardStyle, borderLeftColor: color }}>
      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: '#1e293b' }}>{value}</p>
    </div>
  )
}

function planColor(plan: string): string {
  switch (plan) {
    case 'premium': return '#fef3c7'
    case 'growth': return '#dbeafe'
    case 'starter': return '#dcfce7'
    default: return '#f1f5f9'
  }
}

function billingColor(status: string): string {
  switch (status) {
    case 'active': return '#16a34a'
    case 'trial': return '#d97706'
    case 'expired': return '#dc2626'
    case 'cancelled': return '#6b7280'
    default: return '#475569'
  }
}

const pageStyle: React.CSSProperties = { padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }
const metricCardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderLeft: '4px solid', borderRadius: '8px', padding: '1.25rem' }
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }
const cardTitle: React.CSSProperties = { fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginTop: 0, marginBottom: '0.75rem' }
const emptyText: React.CSSProperties = { color: '#94a3b8', fontSize: '0.85rem' }
const miniTable: React.CSSProperties = { width: '100%', fontSize: '0.85rem' }
const miniTd: React.CSSProperties = { padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9' }
const planBadge: React.CSSProperties = { padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 500, textTransform: 'capitalize' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.6rem 0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }
const tdStyle: React.CSSProperties = { padding: '0.6rem 0.5rem', borderBottom: '1px solid #f1f5f9' }
const inputStyle: React.CSSProperties = { padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }
const logoutBtn: React.CSSProperties = { background: '#1e293b', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }
const editBtn: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.3rem 0.7rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }
const addOrgBtn: React.CSSProperties = { background: '#10b981', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }
const modalInputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }
const saveBtnStyle: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }
const cancelBtnStyle: React.CSSProperties = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '0.6rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }
