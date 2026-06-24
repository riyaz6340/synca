import { useEffect, useState, useCallback } from 'react'
import apiClient from '../../api/client'

interface ChannelConfig {
  type: string
  enabled: boolean
  config: Record<string, string>
  priority: number
}

interface OrganizationChannels {
  channels: ChannelConfig[]
}

interface Stakeholder {
  id: string
  name: string
  communication_channels: ChannelConfig[]
}

export default function ChannelsPage() {
  const [orgChannels, setOrgChannels] = useState<ChannelConfig[]>([])
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null)
  const [stakeholderChannels, setStakeholderChannels] = useState<ChannelConfig[]>([])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [orgRes, stakeholderRes] = await Promise.all([
        apiClient.get('/channels/organization'),
        apiClient.get('/persons'),
      ])
      // channels from org endpoint is an object like { sms: {...}, email: {...} }
      // Convert to our array format for display
      const channelsObj = orgRes.data.channels ?? {}
      const channelsList = Object.keys(channelsObj).length > 0
        ? Object.entries(channelsObj).map(([type, config], i) => ({
            type,
            enabled: true,
            config: (config as { credentials?: Record<string, string> }).credentials ?? {},
            priority: i + 1,
          }))
        : defaultChannels()
      setOrgChannels(channelsList)
      setStakeholders(stakeholderRes.data.data ?? [])
    } catch {
      setError('Failed to load channel configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  async function saveOrgChannels() {
    setSaving(true)
    try {
      await apiClient.put('/channels/organization', { channels: orgChannels })
      alert('Organization channels saved!')
    } catch {
      alert('Failed to save channels')
    } finally {
      setSaving(false)
    }
  }

  function toggleChannel(index: number) {
    setOrgChannels((prev) =>
      prev.map((ch, i) => (i === index ? { ...ch, enabled: !ch.enabled } : ch))
    )
  }

  function updatePriority(index: number, priority: number) {
    setOrgChannels((prev) =>
      prev.map((ch, i) => (i === index ? { ...ch, priority } : ch))
    )
  }

  async function openStakeholderChannels(stakeholder: Stakeholder) {
    setEditingStakeholder(stakeholder)
    try {
      const res = await apiClient.get(`/channels/stakeholder/${stakeholder.id}`)
      setStakeholderChannels(res.data.channels ?? defaultChannels())
    } catch {
      setStakeholderChannels(defaultChannels())
    }
  }

  async function saveStakeholderChannels() {
    if (!editingStakeholder) return
    try {
      await apiClient.put(`/channels/stakeholder/${editingStakeholder.id}`, { channels: stakeholderChannels })
      setEditingStakeholder(null)
      alert('Stakeholder channels saved!')
    } catch {
      alert('Failed to save stakeholder channels')
    }
  }

  if (loading) return <p>Loading channels...</p>
  if (error) return <p style={{ color: 'red' }}>{error}</p>

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Communication Channels</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Organization Channel Settings</h2>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Channel</th>
              <th style={thStyle}>Enabled</th>
              <th style={thStyle}>Priority</th>
            </tr>
          </thead>
          <tbody>
            {orgChannels.map((ch, i) => (
              <tr key={ch.type}>
                <td style={tdStyle}>{ch.type}</td>
                <td style={tdStyle}>
                  <input type="checkbox" checked={ch.enabled} onChange={() => toggleChannel(i)} />
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={ch.priority}
                    onChange={(e) => updatePriority(i, Number(e.target.value))}
                    style={{ width: '60px', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => void saveOrgChannels()} disabled={saving} style={{ ...btnPrimary, marginTop: '1rem' }}>
          {saving ? 'Saving...' : 'Save Organization Channels'}
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Stakeholder Channel Preferences</h2>
        {stakeholders.length === 0 ? (
          <p style={{ color: '#64748b' }}>No stakeholders found.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stakeholders.map((s) => (
                <tr key={s.id}>
                  <td style={tdStyle}>{s.name}</td>
                  <td style={tdStyle}>
                    <button onClick={() => void openStakeholderChannels(s)} style={btnSmall}>Configure</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Stakeholder Channel Modal */}
      {editingStakeholder && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ marginTop: 0 }}>Channels: {editingStakeholder.name}</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Channel</th>
                  <th style={thStyle}>Enabled</th>
                  <th style={thStyle}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {stakeholderChannels.map((ch, i) => (
                  <tr key={ch.type}>
                    <td style={tdStyle}>{ch.type}</td>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={ch.enabled}
                        onChange={() => setStakeholderChannels((prev) => prev.map((c, idx) => idx === i ? { ...c, enabled: !c.enabled } : c))}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={ch.priority}
                        onChange={(e) => setStakeholderChannels((prev) => prev.map((c, idx) => idx === i ? { ...c, priority: Number(e.target.value) } : c))}
                        style={{ width: '60px', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => void saveStakeholderChannels()} style={btnPrimary}>Save</button>
              <button onClick={() => setEditingStakeholder(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function defaultChannels(): ChannelConfig[] {
  return [
    { type: 'push_notification', enabled: true, config: {}, priority: 1 },
    { type: 'whatsapp', enabled: true, config: {}, priority: 2 },
    { type: 'sms', enabled: true, config: {}, priority: 3 },
    { type: 'email', enabled: true, config: {}, priority: 4 },
  ]
}

const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSecondary: React.CSSProperties = { background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }
const btnSmall: React.CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: '8px', padding: '1.5rem', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }
