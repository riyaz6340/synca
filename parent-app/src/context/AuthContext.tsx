/**
 * Auth Context — owns token state, login/logout, session restoration via
 * refresh, and exposes auth status + user role to ProtectedRoute.
 *
 * Validates: Requirements 2.1, 2.4, 2.5
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AppUser, AppRole } from '../api/types';
import { authApi } from '../api/endpoints';
import { setToken, clearToken, getToken } from '../api/client';

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

interface AuthContextType {
  token: string | null;
  user: AppUser | null;
  role: AppRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, organizationName: string, organizationId?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'parent_app_token';
const USER_KEY = 'parent_app_user';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AppUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = token !== null;
  const role: AppRole | null = user?.role ?? null;

  // On mount: attempt silent refresh if a stored token exists (Req 2.4)
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      // Ensure the API client has the token for the refresh request
      setToken(storedToken);
      authApi
        .refresh(storedToken)
        .then((res) => {
          const newToken = res.token;
          localStorage.setItem(TOKEN_KEY, newToken);
          setToken(newToken);
          setTokenState(newToken);
          setIsLoading(false);
        })
        .catch(() => {
          // Token invalid/expired — clear and require login
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          clearToken();
          setTokenState(null);
          setUser(null);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  // login: call authApi.login, store token on success (Req 2.1)
  const login = useCallback(async (email: string, password: string, organizationName: string, organizationId?: string) => {
    const response = await authApi.login({
      email,
      password,
      organization_name: organizationName,
      organization_id: organizationId,
    });

    const { token: newToken, user: newUser } = response;

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  // logout: call authApi.logout, discard token, redirect to login (Req 2.4)
  const logout = useCallback(async () => {
    const currentToken = getToken();
    try {
      if (currentToken) {
        await authApi.logout(currentToken);
      }
    } catch {
      // Proceed with local logout even if server call fails
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearToken();
    setTokenState(null);
    setUser(null);

    // Redirect to login page (Req 2.4)
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, role, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
