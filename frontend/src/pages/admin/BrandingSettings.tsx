import { useState, FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import apiClient from '../../api/client'

export default function BrandingSettings() {
  const { logoUrl, primaryColor, updateBranding } = useAuth()
  const [logoInput, setLogoInput] = useState(logoUrl ?? '')
  const [colorInput, setColorInput] = useState(primaryColor ?? '#2563eb')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isValidHttpsUrl = (value: string): boolean => {
    if (!value) return false
    try {
      const url = new URL(value)
      return url.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSuccess(false)
    setSubmitting(true)

    try {
      await apiClient.put('/organization', {
        metadata: {
          logo_url: logoInput || null,
          primary_color: colorInput || null,
        },
      })
      updateBranding(logoInput || null, colorInput || null)
      setSuccess(true)
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.details) {
        const fieldErrors: Record<string, string> = {}
        for (const detail of err.response.data.details) {
          fieldErrors[detail.field] = detail.message
        }
        setErrors(fieldErrors)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Branding Settings</h1>

      {success && (
        <div style={successStyle} role="status">
          Branding saved successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        {/* Logo URL Input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="logo-url" style={labelStyle}>
            Logo URL <span style={{ color: '#64748b', fontWeight: 400 }}>(HTTPS required)</span>
          </label>
          <input
            id="logo-url"
            type="text"
            value={logoInput}
            onChange={(e) => setLogoInput(e.target.value)}
            placeholder="https://example.com/logo.png"
            style={inputStyle}
          />
          {errors.logo_url && (
            <p style={errorStyle}>{errors.logo_url}</p>
          )}

          {/* Live logo preview */}
          {isValidHttpsUrl(logoInput) && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.25rem' }}>Preview:</p>
              <img
                src={logoInput}
                alt="Logo preview"
                style={{ maxWidth: 200, maxHeight: 64, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 4, padding: 4 }}
              />
            </div>
          )}
        </div>

        {/* Primary Color Input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="primary-color" style={labelStyle}>
            Primary Color <span style={{ color: '#64748b', fontWeight: 400 }}>(#RRGGBB format)</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              id="primary-color"
              type="text"
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              placeholder="#2563eb"
              style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
            />
            <div
              data-testid="color-swatch"
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                backgroundColor: colorInput,
                flexShrink: 0,
              }}
              aria-label={`Color preview: ${colorInput}`}
            />
          </div>
          {errors.primary_color && (
            <p style={errorStyle}>{errors.primary_color}</p>
          )}
        </div>

        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? 'Saving...' : 'Save Branding'}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.4rem',
  fontWeight: 600,
  fontSize: '0.9rem',
  color: '#1e293b',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const errorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '0.8rem',
  marginTop: '0.3rem',
  marginBottom: 0,
}

const successStyle: React.CSSProperties = {
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  color: '#166534',
  padding: '0.75rem 1rem',
  borderRadius: 6,
  marginBottom: '1.25rem',
  fontSize: '0.9rem',
}

const buttonStyle: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '0.6rem 1.5rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
}
