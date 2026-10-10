import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BriefcaseBusiness,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Users,
} from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'

interface AppShellProps {
  children: ReactNode
}

interface CurrentUser {
  id?: number
  email: string
  role: string
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    let active = true

    async function loadCurrentUser() {
      try {
        const response = await apiFetch('/api/v1/auth/me', {
          credentials: 'include',
        })

        if (!response.ok) {
          if (active) {
            setUser(null)
          }
          return
        }

        const data = await response.json()

        if (active) {
          setUser(data)
        }
      } catch (error) {
        console.error('Could not load current user:', error)
        if (active) {
          setUser(null)
        }
      } finally {
        if (active) {
          setLoadingUser(false)
        }
      }
    }

    loadCurrentUser()

    return () => {
      active = false
    }
  }, [])

  const role = user?.role?.toLowerCase()
  const isHR = role === 'hr'
  const displayName = isHR ? 'HR Manager' : 'Viewer'
  const initials = isHR ? 'HR' : 'VW'

  const pageTitle =
    location.pathname.startsWith('/jobs/') &&
    location.pathname.endsWith('/candidates')
      ? 'Candidates'
      : location.pathname.includes('/requirements')
        ? 'Requirements'
        : location.pathname.includes('/upload')
          ? 'Resume Upload'
          : location.pathname === '/jobs'
            ? 'Jobs'
            : location.pathname === '/dashboard'
              ? 'Dashboard'
              : 'HR Assistant'

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`

  async function handleLogout() {
    try {
      await apiFetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      setUser(null)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-slate-950 text-white lg:flex">
        <div className="flex h-20 shrink-0 items-center border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Sparkles size={20} />
          </div>
          <div className="ml-3">
            <p className="font-semibold tracking-tight">HR Assistant</p>
            <p className="text-xs text-slate-400">Hiring workspace</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Workspace
          </p>

          <div className="space-y-1">
            {isHR && (
              <NavLink to="/dashboard" className={navClass}>
                <LayoutDashboard size={18} />
                Dashboard
              </NavLink>
            )}

            <NavLink to="/jobs" end className={navClass}>
              <BriefcaseBusiness size={18} />
              Jobs
            </NavLink>

            <NavLink to="/jobs/1/candidates" className={navClass}>
              <Users size={18} />
              Candidates
            </NavLink>
          </div>

        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold">
              {initials}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {loadingUser ? 'Loading user…' : displayName}
              </p>
              <p className="truncate text-xs text-slate-400">
                {user?.email ?? 'Not signed in'}
              </p>
            </div>

            <button
              type="button"
              aria-label="Log out"
              onClick={handleLogout}
              className="text-slate-500 hover:text-white"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8">
          <div>
            <p className="text-sm text-slate-500">Hiring workspace</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {initials}
            </span>
            <span className="hidden sm:block">
              {loadingUser ? 'Loading…' : displayName}
            </span>
            <ChevronDown size={15} className="text-slate-400" />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
