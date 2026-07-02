import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import apiClient from '../api/client'

interface Organization {
  id: string
  name: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Fetch organizations on mount and when search changes
  const fetchOrganizations = useCallback(async (search: string) => {
    try {
      const params: Record<string, string> = {}
      if (search.trim()) params.search = search.trim()
      const res = await apiClient.get('/auth/organizations', { params })
      setOrganizations(res.data.organizations ?? [])
    } catch {
      setOrganizations([])
    }
  }, [])

  useEffect(() => {
    void fetchOrganizations('')
  }, [fetchOrganizations])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleOrgInputChange(value: string) {
    setOrganizationName(value)
    setSelectedOrgId('')
    setShowDropdown(true)
    void fetchOrganizations(value)
  }

  function handleSelectOrg(org: Organization) {
    setOrganizationName(org.name)
    setSelectedOrgId(org.id)
    setShowDropdown(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedOrgId && !organizationName.trim()) {
      setError('Please select your institution/organization')
      return
    }

    setLoading(true)

    try {
      await login(email, password, organizationName, selectedOrgId || undefined)
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (user.role === 'SuperAdmin') {
        navigate('/super-admin', { replace: true })
      } else if (user.role === 'Admin' || user.role === 'Teacher') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/portal', { replace: true })
      }
    } catch {
      setError('Invalid credentials. Please check your email, password, and institution name.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <form onSubmit={(e) => void handleSubmit(e)} style={formStyle} aria-label="Login form">
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', textAlign: 'center', color: '#1e293b' }}>
          Arixx
        </h1>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Smart Attendance Platform
        </p>

        {error && (
          <div role="alert" style={errorStyle}>
            {error}
          </div>
        )}

        {/* Organization Selector */}
        <div style={{ marginBottom: '1rem', position: 'relative' }} ref={dropdownRef}>
          <label htmlFor="organization" style={labelStyle}>
            Institution / Organization
          </label>
          <input
            id="organization"
            type="text"
            value={organizationName}
            onChange={(e) => handleOrgInputChange(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            required
            placeholder="Type to search your institution..."
            autoComplete="off"
            style={inputStyle}
          />
          {showDropdown && organizations.length > 0 && (
            <div style={dropdownStyle}>
              {organizations.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  style={{
                    padding: '0.6rem 0.75rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '0.9rem',
                    background: org.id === selectedOrgId ? '#eff6ff' : '#fff',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#f8fafc' }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = org.id === selectedOrgId ? '#eff6ff' : '#fff' }}
                >
                  {org.name}
                </div>
              ))}
            </div>
          )}
          {showDropdown && organizations.length === 0 && organizationName.trim().length > 0 && (
            <div style={dropdownStyle}>
              <div style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                No organizations found
              </div>
            </div>
          )}
        </div>

        {/* Email */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={labelStyle}>Email / Admission Number</label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="admin@institution.com or admission number"
            style={inputStyle}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' }}
            >
              {showPassword ? '🙈 Hide' : '👁️ Show'}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ ...submitBtnStyle, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
}

const formStyle: React.CSSProperties = {
  background: '#fff',
  padding: '2.5rem',
  borderRadius: '12px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  width: '100%',
  maxWidth: '400px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.4rem',
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#374151',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s',
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  marginTop: '2px',
  maxHeight: '200px',
  overflowY: 'auto',
  zIndex: 100,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
}

const errorStyle: React.CSSProperties = {
  background: '#fef2f2',
  color: '#dc2626',
  padding: '0.75rem',
  borderRadius: '6px',
  marginBottom: '1rem',
  fontSize: '0.85rem',
}

const submitBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '1rem',
  fontWeight: 500,
  cursor: 'pointer',
}
