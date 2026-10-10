import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Plus,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'

interface Job {
  id: number
  title: string
  description: string
  status: string
  requirements_confirmed: boolean
  created_by_id: number
  created_at: string
}

interface Application {
  application_id: number
  job_id: number
}

type JobStatus = 'Draft' | 'Open' | 'Closed'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [userRole, setUserRole] = useState('')
  const isHR = userRole.trim().toLowerCase() === 'hr'
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingJobId, setEditingJobId] = useState<number | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)
  const [confirmingRequirementsId, setConfirmingRequirementsId] = useState<number | null>(null)
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const loadJobs = async () => {
    setLoading(true)
    setError('')

    try {
      const [jobsResponse, applicationsResponse] = await Promise.all([
        apiFetch('/api/v1/jobs', { credentials: 'include' }),
        apiFetch('/api/v1/applications', { credentials: 'include' }),
      ])

      if (!jobsResponse.ok) {
        if (jobsResponse.status === 401 || jobsResponse.status === 403) {
          throw new Error('Please sign in with an HR account to view jobs.')
        }
        throw new Error('Failed to load job openings.')
      }

      const jobsData: Job[] = await jobsResponse.json()
      setJobs(jobsData)

      if (applicationsResponse.ok) {
        const applicationsData: Application[] =
          await applicationsResponse.json()
        setApplications(applicationsData)
      } else if (
        applicationsResponse.status === 401 ||
        applicationsResponse.status === 403
      ) {
        throw new Error('Your session may have expired. Please sign in again.')
      } else {
        setApplications([])
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load job openings.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadJobs()
  }, [])

  useEffect(() => {
    let active = true

    const fetchCurrentUser = async () => {
      try {
        const response = await apiFetch('/api/v1/auth/me', {
          credentials: 'include',
        })

        if (!response.ok) {
          if (active) setUserRole('')
          return
        }

        const user: { role?: string } = await response.json()
        if (active) setUserRole(user.role ?? '')
      } catch (err) {
        console.error('Failed to fetch current user role:', err)
        if (active) setUserRole('')
      }
    }

    void fetchCurrentUser()
    return () => {
      active = false
    }
  }, [])

  const filteredJobs = jobs.filter((job) => {
    const query = search.toLowerCase()
    const matchesSearch =
      job.title.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query)
    const matchesStatus =
      statusFilter === 'All' ||
      job.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'Date unavailable'

    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleCreate = async () => {
    if (!isHR) return
    if (!title.trim() || !description.trim()) {
      setError('Please enter both a job title and description.')
      return
    }

    setCreating(true)
    setError('')
    setSuccess('')

    try {
      const response = await apiFetch('/api/v1/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status: 'Draft',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        if (response.status === 401 || response.status === 403) {
          throw new Error('You are not authorized to create a job.')
        }

        throw new Error(data?.detail || 'Failed to create job opening.')
      }

      const createdJob: Job = await response.json()

      setJobs((previous) => [
        createdJob,
        ...previous.filter((job) => job.id !== createdJob.id),
      ])

      setTitle('')
      setDescription('')
      setShowCreate(false)
      setStatusFilter('All')
      setSearch('')
      setSuccess(`"${createdJob.title}" was created successfully.`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create job opening.',
      )
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (jobId: number, newStatus: JobStatus) => {
    if (!isHR) return
    const previousJob = jobs.find((job) => job.id === jobId)

    if (!previousJob || previousJob.status === newStatus) return

    setUpdatingStatusId(jobId)
    setError('')
    setSuccess('')

    try {
      const response = await apiFetch(`/api/v1/jobs/${jobId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        if (response.status === 401 || response.status === 403) {
          throw new Error('You are not authorized to update job status.')
        }

        throw new Error(data?.detail || 'Failed to update job status.')
      }

      const updatedJob: Job = await response.json()

      setJobs((previous) =>
        previous.map((job) => (job.id === jobId ? updatedJob : job)),
      )
      setSuccess(`${updatedJob.title} status changed to ${updatedJob.status}.`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update job status.',
      )
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleConfirmRequirements = async (job: Job) => {
    if (!isHR) return
    if (job.requirements_confirmed || confirmingRequirementsId !== null) return

    setConfirmingRequirementsId(job.id)
    setError('')
    setSuccess('')

    try {
      const response = await apiFetch(
        `/api/v1/jobs/${job.id}/requirements/confirm`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('You are not authorized to confirm these requirements.')
        }
        throw new Error(data?.detail || 'Failed to confirm job requirements.')
      }

      setJobs((previous) =>
        previous.map((item) =>
          item.id === job.id
            ? { ...item, requirements_confirmed: true }
            : item,
        ),
      )
      setSuccess(`Requirements for "${job.title}" are confirmed. Candidate screening is now available.`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to confirm job requirements.',
      )
    } finally {
      setConfirmingRequirementsId(null)
    }
  }

  const startEditingJob = (job: Job) => {
    if (!isHR) return
    setTitle(job.title)
    setDescription(job.description)
    setEditingJobId(job.id)
    setError('')
    setSuccess('')
  }

  const cancelEditingJob = () => {
    setEditingJobId(null)
    setTitle('')
    setDescription('')
    setError('')
  }

  const handleSaveEdit = async () => {
    if (!isHR) return
    if (editingJobId === null) return

    if (!title.trim() || !description.trim()) {
      setError('Please enter both a job title and description.')
      return
    }

    setSavingEdit(true)
    setError('')
    setSuccess('')

    try {
      const response = await apiFetch(`/api/v1/jobs/${editingJobId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        if (response.status === 401 || response.status === 403) {
          throw new Error('You are not authorized to edit this job.')
        }

        throw new Error(data?.detail || 'Failed to save job changes.')
      }

      const updatedJob: Job = await response.json()

      setJobs((previous) =>
        previous.map((job) => (job.id === editingJobId ? updatedJob : job)),
      )
      setSuccess(`"${updatedJob.title}" was updated successfully.`)
      setEditingJobId(null)
      setTitle('')
      setDescription('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save job changes.',
      )
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteJob = async () => {
    if (!isHR) return
    if (!jobToDelete) return

    const jobId = jobToDelete.id
    setDeletingJobId(jobId)
    setError('')
    setSuccess('')

    try {
      const response = await apiFetch(`/api/v1/jobs/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)

        if (response.status === 401 || response.status === 403) {
          throw new Error('You are not authorized to archive this job.')
        }

        throw new Error(data?.detail || 'Failed to archive job.')
      }

      setJobs((previous) => previous.filter((job) => job.id !== jobId))
      setSuccess(
        `"${jobToDelete.title}" was archived. Its application history has been preserved.`,
      )
      setJobToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive job.')
    } finally {
      setDeletingJobId(null)
    }
  }

  if (showCreate && isHR) {
    return (
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => {
            setShowCreate(false)
            setError('')
          }}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back to jobs
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6 sm:p-8">
            <p className="text-sm font-semibold text-blue-600">New opening</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Create a job opening
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Add the role details to create a draft job.
            </p>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div>
              <label
                htmlFor="job-title"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Job title
              </label>
              <input
                id="job-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Senior Software Engineer"
                maxLength={255}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label
                htmlFor="job-description"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Job description
              </label>
              <textarea
                id="job-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={9}
                maxLength={20000}
                required
                placeholder="Describe the role, responsibilities, skills and experience required..."
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3.5 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
              <p className="mt-2 text-xs text-slate-400">
                A detailed description helps HR define the job requirements.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={creating}
                onClick={() => {
                  setShowCreate(false)
                  setError('')
                }}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !title.trim() || !description.trim()}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? 'Creating...' : 'Create draft job'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (editingJobId !== null && isHR) {
    const editingJob = jobs.find((job) => job.id === editingJobId)

    return (
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={cancelEditingJob}
          disabled={savingEdit}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
        >
          <ArrowLeft size={17} />
          Back to jobs
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6 sm:p-8">
            <p className="text-sm font-semibold text-blue-600">Edit opening</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Edit job details
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Update the title or description for {editingJob?.title ?? 'this job'}.
            </p>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div>
              <label
                htmlFor="edit-job-title"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Job title
              </label>
              <input
                id="edit-job-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Senior Software Engineer"
                maxLength={255}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label
                htmlFor="edit-job-description"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Job description
              </label>
              <textarea
                id="edit-job-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={9}
                maxLength={20000}
                required
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3.5 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelEditingJob}
                disabled={savingEdit}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={savingEdit || !title.trim() || !description.trim()}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingEdit ? 'Saving changes...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-blue-600">Recruitment</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Job openings
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Create openings and manage your candidate pipeline.
          </p>
        </div>

        {isHR && (
          <button
            type="button"
            onClick={() => {
              setError('')
              setSuccess('')
              setShowCreate(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Create job
          </button>
        )}
      </section>

      {success && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess('')}
            className="font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          {(error.toLowerCase().includes('sign in') ||
            error.toLowerCase().includes('authorized')) && (
            <Link to="/login" className="ml-2 font-semibold underline">
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={() => void loadJobs()}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search job openings..."
            className="w-full rounded-xl bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <select
          aria-label="Filter jobs by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 outline-none focus:border-blue-500"
        >
          <option value="All">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h3 className="font-semibold text-slate-900">All openings</h3>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? 'Loading jobs...' : `${filteredJobs.length} openings found`}
          </p>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Loading job openings...
          </p>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <CheckCircle2 size={32} className="text-slate-300" />
            <h4 className="mt-4 font-semibold text-slate-900">No jobs found</h4>
            <p className="mt-1 text-sm text-slate-500">
              Try another search or create a new opening.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredJobs.map((job) => {
              const candidateCount = applications.filter(
                (application) => application.job_id === job.id,
              ).length

              return (
                <div
                  key={job.id}
                  className="group flex flex-col gap-5 p-6 transition hover:bg-slate-50 lg:flex-row lg:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <BriefcaseBusiness size={20} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate font-semibold text-slate-900">
                        {job.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500">
                        Created {formatDate(job.created_at)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                        {job.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {candidateCount}
                      </p>
                      <p className="text-xs text-slate-400">Candidates</p>
                    </div>

                    {isHR && (
                      <button
                        type="button"
                        onClick={() => {
                          setError('')
                          setSuccess('')
                          setJobToDelete(job)
                        }}
                        disabled={
                          updatingStatusId === job.id || deletingJobId === job.id
                        }
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}

                    {isHR && (
                      <button
                        type="button"
                        onClick={() => startEditingJob(job)}
                        disabled={updatingStatusId === job.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit job
                      </button>
                    )}

                    {isHR && (
                      <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`job-status-${job.id}`}
                        className="text-xs font-medium text-slate-500"
                      >
                        Job status
                      </label>
                      <select
                        id={`job-status-${job.id}`}
                        value={job.status}
                        disabled={updatingStatusId === job.id}
                        onChange={(event) =>
                          void handleStatusChange(
                            job.id,
                            event.target.value as JobStatus,
                          )
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-blue-500/20 disabled:cursor-wait disabled:opacity-60 ${
                          job.status === 'Open'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : job.status === 'Draft'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                      </select>
                      {updatingStatusId === job.id && (
                        <span className="text-xs text-blue-600">Updating...</span>
                      )}
                      </div>
                    )}

                    {isHR && (
                    <div className="flex flex-col items-start gap-2">
                      <Link
                        to={`/jobs/${job.id}/requirements`}
                        aria-label={`Manage requirements for ${job.title}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
                      >
                        Manage requirements <ChevronRight size={14} />
                      </Link>
                      {job.requirements_confirmed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 size={14} /> Requirements confirmed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleConfirmRequirements(job)}
                          disabled={confirmingRequirementsId !== null}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-50"
                        >
                          {confirmingRequirementsId === job.id
                            ? 'Confirming...'
                            : 'Confirm requirements'}
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {isHR && jobToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && deletingJobId === null) {
              setJobToDelete(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-job-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <BriefcaseBusiness size={21} />
            </div>
            <h3
              id="archive-job-title"
              className="mt-4 text-lg font-bold text-slate-900"
            >
              Archive this job?
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to archive <strong>{jobToDelete.title}</strong>?
              It will disappear from the active Jobs list. Existing applications
              and screening history will be retained.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deletingJobId !== null}
                onClick={() => {
                  setJobToDelete(null)
                  setError('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingJobId === jobToDelete.id}
                onClick={() => void handleDeleteJob()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {deletingJobId === jobToDelete.id ? 'Archiving...' : 'Archive job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
