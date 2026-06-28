import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import apiClient from '../api/client'

export interface User {
  id: string
  email: string
  role: 'Admin' | 'Stakeholder' | 'SuperAdmin'
  organization_id: string
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, orgIdentifier: string, orgId?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: true,
  })

  useEffect(() => {
    // On mount, if a token exists, silently refresh it to extend the session.
    // This means active users effectively never get logged out.
    const token = localStorage.getItem('token')
    if (token) {
      apiClient
        .post('/auth/refresh', { token })
        .then((res) => {
          const newToken = res.data.token
          if (newToken) {
            localStorage.setItem('token', newToken)
            setState((prev) => ({ ...prev, token: newToken, isAuthenticated: true, isLoading: false }))
          } else {
            setState((prev) => ({ ...prev, isLoading: false }))
          }
        })
        .catch(() => {
          // Token invalid/expired — clear and require login
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setState({ token: null, user: null, isAuthenticated: false, isLoading: false })
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

    setState({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
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

    setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
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
