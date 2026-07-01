import { useEffect } from 'react'
import { useAuth } from './AuthContext'

const DEFAULT_PRIMARY = '#2563eb'

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { primaryColor } = useAuth()

  useEffect(() => {
    const color = primaryColor ?? DEFAULT_PRIMARY
    document.documentElement.style.setProperty('--brand-primary', color)
  }, [primaryColor])

  return <>{children}</>
}
