import { useEffect, useState } from 'react'
import {
  BriefcaseBusiness,
  Clock3,
  Plus,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
interface Job {
  id: number
  title: string
  description?: string
  status: string
  created_at?: string
}

interface Application {
  application_id: number
  candidate_id: number
  name: string
  email: string | null
  job_id: number
  resume_filename: string
  score: number | null
  verdict: string | null
  screening_status: string
  stage: string
}

export default function DashboardPage() {
  const location = useLocation()
  const [jobs, setJobs] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const [jobsResponse, applicationsResponse] = await Promise.all([
          fetch('/api/v1/jobs', { credentials: 'include' }),
          fetch('/api/v1/applications', { credentials: 'include' }),
        ])

        if (!jobsResponse.ok || !applicationsResponse.ok) {
          if (
            jobsResponse.status === 401 ||
            jobsResponse.status === 403 ||
            applicationsResponse.status === 401 ||
            applicationsResponse.status === 403
          ) {
            throw new Error(
              'Your session may have expired. Please sign in again.',
            )
          }

          throw new Error('Unable to load dashboard data from the server.')
        }

        const jobsData: Job[] = await jobsResponse.json()
        const applicationsData: Application[] =
          await applicationsResponse.json()

        setJobs(jobsData)
        setApplications(applicationsData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Something went wrong while loading the dashboard.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [location.key])

  const activeJobs = jobs.filter(
    (job) => job.status.toLowerCase() === 'open',
  ).length

const screeningCount = applications.filter((application) => {
  const status = application.screening_status.toLowerCase()
  return status === 'queued' ||
    status === 'processing' ||
    status === 'screening'
}).length

  const shortlistedCount = applications.filter(
    (application) => application.stage.toLowerCase() === 'shortlisted',
  ).length

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Date unavailable'

    const date = new Date(dateString)

    if (Number.isNaN(date.getTime())) return 'Date unavailable'

    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">

      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-blue-600">Overview</p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Your hiring pipeline
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage openings and review AI-assisted candidate screening.
          </p>
        </div>

        <Link
          to="/jobs"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        >
          <Plus size={18} />
          View jobs
        </Link>
      </section>

      {/* Loading and error states */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Loading dashboard data...
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          {error.includes('sign in') && (
            <Link
              to="/login"
              className="ml-2 font-semibold underline"
            >
              Sign in
            </Link>
          )}
        </div>
      )}

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BriefcaseBusiness size={20} />
            </div>
          </div>

          <p className="mt-5 text-sm text-slate-500">Active jobs</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {loading ? '—' : activeJobs}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users size={20} />
          </div>

          <p className="mt-5 text-sm text-slate-500">Candidates</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {loading ? '—' : applications.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock3 size={20} />
          </div>

          <p className="mt-5 text-sm text-slate-500">Screening</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {loading ? '—' : screeningCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ArrowUpRight size={20} />
          </div>

          <p className="mt-5 text-sm text-slate-500">Shortlisted</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {loading ? '—' : shortlistedCount}
          </p>
        </div>

      </section>

      {/* Recent jobs */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold text-slate-900">
              Recent job openings
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Track your current recruitment activity.
            </p>
          </div>

          <Link
            to="/jobs"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            View all jobs →
          </Link>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">
            Loading job openings...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <BriefcaseBusiness
              size={28}
              className="mx-auto text-slate-400"
            />
            <p className="mt-3 font-medium text-slate-700">
              No job openings yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Create a job to start building your hiring pipeline.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.slice(0, 5).map((job) => {
              const candidateCount = applications.filter(
                (application) => application.job_id === job.id,
              ).length

              const isOpen = job.status.toLowerCase() === 'open'

              return (
                <div
                  key={job.id}
                  className="flex flex-col gap-4 p-6 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <BriefcaseBusiness size={19} />
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {job.title}
                      </h4>

                      <p className="mt-1 text-sm text-slate-500">
                        Updated {formatDate(job.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:ml-auto sm:gap-6">
                    <div className="text-sm">
                      <span className="font-semibold text-slate-900">
                        {candidateCount}
                      </span>{' '}
                      <span className="text-slate-500">candidates</span>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isOpen
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {job.status}
                    </span>

                    <Link
                      to={`/jobs/${job.id}/requirements`}
                      aria-label={`View requirements for ${job.title}`}
                      className="text-slate-400 transition hover:text-slate-700"
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
