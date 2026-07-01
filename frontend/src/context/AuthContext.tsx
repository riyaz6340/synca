import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import apiClient from '../api/client'

export interface User {
  id: string
  email: string
  role: 'Admin' | 'Stakeholder' | 'SuperAdmin' | 'Teacher'
  organization_id: string
}

export interface TeacherContext {
  permissions: string[]
  assignedGroups: Array<{ id: string; name: string }>
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  teacherContext: TeacherContext | null
  organizationName: string | null
  logoUrl: string | null
  primaryColor: string | null
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, orgIdentifier: string, orgId?: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  updateBranding: (logoUrl: string | null, primaryColor: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchTeacherContext(): Promise<TeacherContext | null> {
  try {
    const [permRes, groupsRes] = await Promise.all([
      apiClient.get('/teachers/me/permissions'),
      apiClient.get('/teachers/me/groups'),
    ])
    return {
      permissions: permRes.data.permissions ?? [],
      assignedGroups: groupsRes.data.groups ?? [],
    }
  } catch {
    return { permissions: [], assignedGroups: [] }
  }
}

async function fetchOrganizationName(): Promise<string | null> {
  try {
    const res = await apiClient.get('/organization/name')
    return res.data.organization_name ?? null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: true,
    teacherContext: JSON.parse(localStorage.getItem('teacherContext') || 'null'),
    organizationName: localStorage.getItem('organizationName'),
    logoUrl: localStorage.getItem('brandingLogoUrl') || null,
    primaryColor: localStorage.getItem('brandingPrimaryColor') || null,
  })

  useEffect(() => {
    // On mount, if a token exists, silently refresh it to extend the session.
    // This means active users effectively never get logged out.
    const token = localStorage.getItem('token')
    if (token) {
      apiClient
        .post('/auth/refresh', { token })
        .then(async (res) => {
          const newToken = res.data.token
          if (newToken) {
            localStorage.setItem('token', newToken)
            const storedUser = JSON.parse(localStorage.getItem('user') || 'null')
            let tContext: TeacherContext | null = null
            if (storedUser?.role === 'Teacher') {
              tContext = await fetchTeacherContext()
              localStorage.setItem('teacherContext', JSON.stringify(tContext))
            }
            // If organizationName was not cached in localStorage, fetch from API
            let cachedOrgName = localStorage.getItem('organizationName')
            if (!cachedOrgName) {
              cachedOrgName = await fetchOrganizationName()
              if (cachedOrgName) {
                localStorage.setItem('organizationName', cachedOrgName)
              }
            }
            // Restore branding from localStorage
            const cachedLogoUrl = localStorage.getItem('brandingLogoUrl') || null
            const cachedPrimaryColor = localStorage.getItem('brandingPrimaryColor') || null
            setState((prev) => ({ ...prev, token: newToken, isAuthenticated: true, isLoading: false, teacherContext: tContext ?? prev.teacherContext, organizationName: cachedOrgName ?? prev.organizationName, logoUrl: cachedLogoUrl, primaryColor: cachedPrimaryColor }))
          } else {
            setState((prev) => ({ ...prev, isLoading: false }))
          }
        })
        .catch(() => {
          // Token invalid/expired — clear and require login
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          localStorage.removeItem('teacherContext')
          localStorage.removeItem('organizationName')
          localStorage.removeItem('brandingLogoUrl')
          localStorage.removeItem('brandingPrimaryColor')
          setState({ token: null, user: null, isAuthenticated: false, isLoading: false, teacherContext: null, organizationName: null, logoUrl: null, primaryColor: null })
        })
    } else {
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (email: string, password: string, orgIdentifier: string, orgId?: string) => {
    const body: Record<string, string> = { email, password }
    if (orgId) {
      body.organization_id = orgId
    } else {
      body.organization_name = orgIdentifier
    }
    const response = await apiClient.post('/auth/login', body)
    const { token, user } = response.data

    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))

    // Extract organization_name from the login response user object
    let orgName: string | null = user.organization_name ?? null
    // Fallback: if login response didn't include organization_name, fetch from API
    if (!orgName) {
      orgName = await fetchOrganizationName()
    }
    if (orgName) {
      localStorage.setItem('organizationName', orgName)
    } else {
      localStorage.removeItem('organizationName')
    }

    // Extract branding fields from login response
    const logoUrl: string | null = user.logo_url ?? null
    const primaryColor: string | null = user.primary_color ?? null
    if (logoUrl) {
      localStorage.setItem('brandingLogoUrl', logoUrl)
    } else {
      localStorage.removeItem('brandingLogoUrl')
    }
    if (primaryColor) {
      localStorage.setItem('brandingPrimaryColor', primaryColor)
    } else {
      localStorage.removeItem('brandingPrimaryColor')
    }

    let tContext: TeacherContext | null = null
    if (user.role === 'Teacher') {
      tContext = await fetchTeacherContext()
      localStorage.setItem('teacherContext', JSON.stringify(tContext))
    } else {
      localStorage.removeItem('teacherContext')
    }

    setState({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
      teacherContext: tContext,
      organizationName: orgName,
      logoUrl,
      primaryColor,
    })
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // Proceed with local logout even if server call fails
    }

    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('teacherContext')
    localStorage.removeItem('organizationName')
    localStorage.removeItem('brandingLogoUrl')
    localStorage.removeItem('brandingPrimaryColor')

    setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      teacherContext: null,
      organizationName: null,
      logoUrl: null,
      primaryColor: null,
    })
  }, [])

  const hasPermission = useCallback((permission: string): boolean => {
    if (!state.user) return false
    // Admin and SuperAdmin have full access
    if (state.user.role === 'Admin' || state.user.role === 'SuperAdmin') return true
    // Teacher checks effective permissions
    if (state.user.role === 'Teacher' && state.teacherContext) {
      return state.teacherContext.permissions.includes(permission)
    }
    return false
  }, [state.user, state.teacherContext])

  const updateBranding = useCallback((logoUrl: string | null, primaryColor: string | null) => {
    if (logoUrl) {
      localStorage.setItem('brandingLogoUrl', logoUrl)
    } else {
      localStorage.removeItem('brandingLogoUrl')
    }
    if (primaryColor) {
      localStorage.setItem('brandingPrimaryColor', primaryColor)
    } else {
      localStorage.removeItem('brandingPrimaryColor')
    }
    setState((prev) => ({ ...prev, logoUrl, primaryColor }))
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, updateBranding }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
