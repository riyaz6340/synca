import { useEffect, useState, useCallback } from 'react'
import apiClient from '../api/client'

interface AnalyticsMetrics {
  dau: number
  wau: number
  mau: number
  yau: number
}

interface TrendDataPoint {
  date: string
  dau: number
}

interface OrgOption {
  id: string
  name: string
}

export default function AnalyticsDashboardWidget() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [trend, setTrend] = useState<TrendDataPoint[]>([])
  const [organizations, setOrganizations] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [orgFilter, setOrgFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateError, setDateError] = useState('')

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await apiClient.get('/auth/organizations')
      const orgs = res.data.organizations ?? res.data.data ?? res.data ?? []
      setOrganizations(Array.isArray(orgs) ? orgs : [])
    } catch {
      // Non-critical, dropdown just stays empty
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setDateError('')

      // Validate date range
      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        if (end < start) {
          setDateError('End date must be on or after start date')
          setLoading(false)
          return
        }
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays > 365) {
          setDateError('Date range cannot exceed 365 days')
          setLoading(false)
          return
        }
      }

      const params: Record<string, string> = {}
      if (orgFilter) params.organization_id = orgFilter
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const [metricsRes, trendRes] = await Promise.all([
        apiClient.get('/super-admin/analytics', { params }),
        apiClient.get('/super-admin/analytics/trend', { params }),
      ])

      setMetrics(metricsRes.data)
      setTrend(trendRes.data.trend ?? trendRes.data ?? [])
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Failed to load analytics data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [orgFilter, startDate, endDate])

  useEffect(() => {
    void fetchOrganizations()
  }, [fetchOrganizations])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  function handleRetry() {
    void fetchAnalytics()
  }

  return (
    <div style={widgetContainer}>
      <div style={widgetHeader}>
        <h3 style={widgetTitle}>User Activity Analytics</h3>
      </div>

      {/* Filters Row */}
      <div style={filtersRow}>
        <div style={filterGroup}>
          <label style={filterLabel}>Organization</label>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            style={filterSelect}
          >
            <option value="">All Organizations</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div style={filterGroup}>
          <label style={filterLabel}>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={filterInput}
          />
        </div>

        <div style={filterGroup}>
          <label style={filterLabel}>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={filterInput}
          />
        </div>
      </div>

      {dateError && <p style={dateErrorStyle}>{dateError}</p>}

      {/* Error State */}
      {error && (
        <div style={errorContainer}>
          <p style={errorText}>{error}</p>
          <button onClick={handleRetry} style={retryBtn}>
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div style={loadingContainer}>
          <p style={loadingText}>Loading analytics...</p>
        </div>
      )}

      {/* Metrics Cards */}
      {!loading && !error && metrics && (
        <>
          <div style={metricsGrid}>
            <AnalyticsMetricCard
              label="Daily Active Users"
              shortLabel="DAU"
              value={metrics.dau}
              color="#3b82f6"
            />
            <AnalyticsMetricCard
              label="Weekly Active Users"
              shortLabel="WAU"
              value={metrics.wau}
              color="#10b981"
            />
            <AnalyticsMetricCard
              label="Monthly Active Users"
              shortLabel="MAU"
              value={metrics.mau}
              color="#8b5cf6"
            />
            <AnalyticsMetricCard
              label="Yearly Active Users"
              shortLabel="YAU"
              value={metrics.yau}
              color="#f59e0b"
            />
          </div>

          {/* 30-Day Trend Chart */}
          {trend.length > 0 && (
            <div style={trendContainer}>
              <h4 style={trendTitle}>30-Day DAU Trend</h4>
              <TrendChart data={trend} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function AnalyticsMetricCard({
  label,
  shortLabel,
  value,
  color,
}: {
  label: string
  shortLabel: string
  value: number
  color: string
}) {
  return (
    <div style={{ ...analyticsCardStyle, borderTopColor: color }}>
      <p style={analyticsCardLabel}>
        {label} <span style={analyticsCardShort}>({shortLabel})</span>
      </p>
      <p style={analyticsCardValue}>{value.toLocaleString()}</p>
    </div>
  )
}

function TrendChart({ data }: { data: TrendDataPoint[] }) {
  const maxDau = Math.max(...data.map((d) => d.dau), 1)

  return (
    <div style={chartContainer}>
      <div style={chartBars}>
        {data.map((point) => {
          const heightPercent = (point.dau / maxDau) * 100
          return (
            <div key={point.date} style={chartBarWrapper} title={`${point.date}: ${point.dau} DAU`}>
              <div
                style={{
                  ...chartBar,
                  height: `${Math.max(heightPercent, 2)}%`,
                }}
              />
            </div>
          )
        })}
      </div>
      <div style={chartXAxis}>
        <span style={chartXLabel}>
          {data.length > 0 ? formatDate(data[0].date) : ''}
        </span>
        <span style={chartXLabel}>
          {data.length > 0 ? formatDate(data[data.length - 1].date) : ''}
        </span>
      </div>
      <div style={chartLegend}>
        <span style={chartLegendText}>
          Max: {maxDau} DAU
        </span>
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Styles
const widgetContainer: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1.25rem',
  marginBottom: '2rem',
}

const widgetHeader: React.CSSProperties = {
  marginBottom: '1rem',
}

const widgetTitle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#334155',
  margin: 0,
}

const filtersRow: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap',
  marginBottom: '1rem',
  alignItems: 'flex-end',
}

const filterGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

const filterLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
  fontWeight: 500,
}

const filterSelect: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  fontSize: '0.85rem',
  minWidth: '160px',
}

const filterInput: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  fontSize: '0.85rem',
}

const dateErrorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '0.8rem',
  margin: '0 0 0.75rem',
}

const errorContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1rem',
  background: '#fef2f2',
  borderRadius: '6px',
  border: '1px solid #fecaca',
}

const errorText: React.CSSProperties = {
  margin: 0,
  color: '#dc2626',
  fontSize: '0.85rem',
  flex: 1,
}

const retryBtn: React.CSSProperties = {
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  padding: '0.4rem 0.8rem',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
}

const loadingContainer: React.CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
}

const loadingText: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.85rem',
  margin: 0,
}

const metricsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '1rem',
  marginBottom: '1.5rem',
}

const analyticsCardStyle: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderTop: '3px solid',
  borderRadius: '6px',
  padding: '1rem',
}

const analyticsCardLabel: React.CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
}

const analyticsCardShort: React.CSSProperties = {
  fontWeight: 600,
  color: '#475569',
}

const analyticsCardValue: React.CSSProperties = {
  margin: '0.5rem 0 0',
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#1e293b',
}

const trendContainer: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  padding: '1rem',
}

const trendTitle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#475569',
  margin: '0 0 0.75rem',
}

const chartContainer: React.CSSProperties = {
  position: 'relative',
}

const chartBars: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '2px',
  height: '120px',
  padding: '0 4px',
}

const chartBarWrapper: React.CSSProperties = {
  flex: 1,
  height: '100%',
  display: 'flex',
  alignItems: 'flex-end',
  cursor: 'pointer',
}

const chartBar: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(to top, #3b82f6, #60a5fa)',
  borderRadius: '2px 2px 0 0',
  minHeight: '2px',
  transition: 'height 0.3s ease',
}

const chartXAxis: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '0.5rem',
  padding: '0 4px',
}

const chartXLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#94a3b8',
}

const chartLegend: React.CSSProperties = {
  textAlign: 'right',
  marginTop: '0.25rem',
}

const chartLegendText: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#94a3b8',
}
