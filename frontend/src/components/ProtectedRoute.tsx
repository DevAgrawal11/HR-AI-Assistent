
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { apiFetch } from '../api'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({
  children,
}: ProtectedRouteProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    let active = true

    apiFetch('/api/v1/auth/me', { credentials: 'include' })
      .then((response) => {
        if (active) {
          setAuthenticated(response.ok)
        }
      })
      .catch(() => {
        if (active) setAuthenticated(false)
      })

    return () => {
      active = false
    }
  }, [])

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Checking your session...
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
