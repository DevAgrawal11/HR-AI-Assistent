import { apiFetch } from '../api'

import { useState } from 'react'
import type { FormEvent } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          data.detail || 'Login failed. Please check your credentials.',
        )
      }

      // Refresh the app after the backend sets the login cookie.
      window.location.href = '/dashboard'
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to the server. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left - Branding */}
        <section className="relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950" />
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-500/20">
                <span className="text-lg font-bold">AI</span>
              </div>
              <div>
                <p className="font-semibold tracking-tight">HR Assistant</p>
                <p className="text-xs text-slate-400">
                  Intelligent hiring operations
                </p>
              </div>
            </div>

            <div className="max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                AI-assisted resume screening
              </div>

              <h1 className="text-5xl font-bold leading-tight tracking-tight xl:text-6xl">
                Hire smarter.
                <br />
                <span className="text-blue-400">Decide faster.</span>
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
                Turn resumes into structured, evidence-grounded insights
                while keeping every hiring decision in the hands of HR.
              </p>

              <div className="mt-10 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-xl font-semibold">AI</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Assisted screening
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-xl font-semibold">100%</p>
                  <p className="mt-1 text-xs text-slate-400">Evidence based</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-xl font-semibold">HR</p>
                  <p className="mt-1 text-xs text-slate-400">Final decision</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">Secure hiring workspace</p>
          </div>
        </section>

        {/* Right - Login */}
        <section className="flex items-center justify-center bg-slate-50 px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                AI
              </div>
              <div>
                <p className="font-semibold text-slate-900">HR Assistant</p>
                <p className="text-xs text-slate-500">
                  Intelligent hiring operations
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
              <div className="mb-8">
                <p className="mb-2 text-sm font-medium text-blue-600">
                  Welcome back
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Sign in to your workspace
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Access your jobs, candidates and AI screening results.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                  {!loading && (
                    <span className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-7 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <div className="mt-0.5 text-sm">🔒</div>
                <p className="text-xs leading-5 text-slate-500">
                  Your session is protected with secure authentication.
                  Access is controlled according to your HR role.
                </p>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              AI assists screening. HR makes the final decision.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
