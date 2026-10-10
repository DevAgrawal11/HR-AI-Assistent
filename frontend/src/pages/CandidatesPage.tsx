import { useEffect, useState } from 'react'

import {

  ArrowLeft,

  ChevronRight,

  Search,

  ShieldCheck,

  Sparkles,

  X,

} from 'lucide-react'

interface Application {

  id: number

  application_id: number

  candidate_id: number

  candidate_name: string

  candidate_email: string | null

  name?: string

  email?: string | null

  job_id: number

  job_title: string

  resume_filename: string

  score: number | null

  verdict: string | null

  screening_status: string

  stage: string

  stage_reason?: string | null

}

interface ApplicationHistoryEvent {

  id: number

  event_type: string

  description: string | null

  created_at: string

}

interface RequirementResult {

  requirement_id: number

  requirement_text: string

  requirement_type: string

  weight: number

  matched: boolean

  match_ratio: number

  assessment: string | null

  explanation: string | null

  evidence: string[]

  missing_information: string[]

  confidence: number | null

}

interface ScreeningDetails {

  application_id: number

  job_id: number

  score: number | null

  screening_status: string

  verdict: string | null

  must_have_requirements_met: boolean

  requirements_confirmed?: boolean

  results_current?: boolean

  results_message?: string

  stage?: string

  stage_reason?: string | null

  missing_must_haves?: {

    requirement_id: number

    requirement: string

    assessment: string | null

  }[]

  unmet_must_have_requirements: {

    requirement_id: number

    requirement: string

    assessment: string | null

  }[]

  requirements: RequirementResult[]

  note?: string

}

const STAGES = [

  'New',

  'Shortlisted',

  'Interview',

  'Rejected',

  'Hired',

] as const

export default function CandidatesPage() {

  const [userRole, setUserRole] = useState('')

  const isHR = userRole.toLowerCase() === 'hr'

  const [history, setHistory] = useState<ApplicationHistoryEvent[]>([])

  const [historyLoading, setHistoryLoading] = useState(false)

  const [historyError, setHistoryError] = useState('')

  const [historyRefresh, setHistoryRefresh] = useState(0)

  const [applications, setApplications] = useState<Application[]>([])

  const [selected, setSelected] = useState<Application | null>(null)

  const [screening, setScreening] = useState<ScreeningDetails | null>(null)

  const [search, setSearch] = useState('')

  const [loading, setLoading] = useState(true)

  const [detailLoading, setDetailLoading] = useState(false)

  const [error, setError] = useState('')

  const [updatingStageId, setUpdatingStageId] = useState<number | null>(null)

  const [stageMessage, setStageMessage] = useState('')

  const [stageError, setStageError] = useState('')

  const [stageReason, setStageReason] = useState('')

  const [screeningRunning, setScreeningRunning] = useState(false)

  const [screeningActionMessage, setScreeningActionMessage] = useState('')

  const [screeningActionError, setScreeningActionError] = useState('')

  useEffect(() => {
    let active = true
    const loadCurrentUser = async () => {
      try {
        const response = await fetch('/api/v1/auth/me', { credentials: 'include' })
        if (!response.ok) { if (active) setUserRole(''); return }
        const user: { role?: string } = await response.json()
        if (active) setUserRole(user.role ?? '')
      } catch (err) {
        console.error('Failed to load current user role:', err)
        if (active) setUserRole('')
      }
    }
    void loadCurrentUser()
    return () => { active = false }
  }, [])

  useEffect(() => {

    const loadApplications = async () => {

      try {

        const response = await fetch('/api/v1/applications', {

          credentials: 'include',

        })

        if (!response.ok) {

          throw new Error(

            response.status === 401 || response.status === 403

              ? 'Please log in with an HR account to view candidates.'

              : 'Failed to load applications.',

          )

        }

        const data: Application[] = await response.json()

        setApplications(data)

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : 'Unable to load applications.',

        )

      } finally {

        setLoading(false)

      }

    }

    loadApplications()

  }, [])

  useEffect(() => {

  if (!selected) {

    setHistory([])

    setHistoryError('')

    return

  }

  let cancelled = false

  const loadHistory = async () => {

    setHistoryLoading(true)

    setHistoryError('')

    try {

      const response = await fetch(

        `/api/v1/applications/${selected.application_id}/history`,

        { credentials: 'include' },

      )

      if (!response.ok) {

        throw new Error('Unable to load candidate history.')

      }

      const data = await response.json()

      if (!cancelled) {

        setHistory(data.history ?? [])

      }

    } catch (err) {

      if (!cancelled) {

        setHistoryError(

          err instanceof Error

            ? err.message

            : 'Unable to load candidate history.',

        )

      }

    } finally {

      if (!cancelled) {

        setHistoryLoading(false)

      }

    }

  }

  loadHistory()

  return () => {

    cancelled = true

  }

}, [selected?.application_id, historyRefresh])

  const openCandidate = async (application: Application) => {

    setSelected(application)

    setStageReason(application.stage_reason ?? '')

    setScreening(null)

    setScreeningActionMessage('')

    setScreeningActionError('')

    setDetailLoading(true)

    setError('')

    try {

      const response = await fetch(

        `/api/v1/applications/${application.application_id}/screening-results`,

        { credentials: 'include' },

      )

      if (response.status === 404) {

        throw new Error('Application screening details were not found.')

      }

      if (!response.ok) {

        throw new Error('Unable to load screening details.')

      }

      const data: ScreeningDetails = await response.json()

      setScreening(data)

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : 'Unable to load screening details.',

      )

    } finally {

      setDetailLoading(false)

    }

  }

  const runScreening = async (application: Application) => {

    if (!isHR) return

    setScreeningRunning(true)

    setScreeningActionMessage('')

    setScreeningActionError('')



    try {

      const response = await fetch(

        `/api/v1/applications/${application.application_id}/screen`,

        {

          method: 'POST',

          credentials: 'include',

        },

      )



      if (!response.ok) {

        const data = await response.json().catch(() => null)

        throw new Error(data?.detail || 'Unable to run candidate screening.')

      }



      const screeningResponse = await fetch(

        `/api/v1/applications/${application.application_id}/screening-results`,

        { credentials: 'include' },

      )

      if (!screeningResponse.ok) {

        throw new Error('Screening completed, but results could not be reloaded.')

      }

      const screeningData: ScreeningDetails = await screeningResponse.json()

      setScreening(screeningData)



      const applicationsResponse = await fetch('/api/v1/applications', {

        credentials: 'include',

      })

      if (applicationsResponse.ok) {

        const applicationData: Application[] = await applicationsResponse.json()

        setApplications(applicationData)

        const refreshedSelected = applicationData.find(

          (item) => item.application_id === application.application_id,

        )

        if (refreshedSelected) setSelected(refreshedSelected)

      }



      setScreeningActionMessage('Screening completed. Review the AI results below.')

    } catch (err) {

      setScreeningActionError(

        err instanceof Error ? err.message : 'Unable to run candidate screening.',

      )

    } finally {

      setScreeningRunning(false)

    }

  }



  const updateCandidateStage = async (

    application: Application,

    newStage: string,

    reason: string = application.stage_reason ?? '',

  ) => {

    if (!isHR) return

    const normalizedReason = reason.trim()

    const savedReason = (application.stage_reason ?? '').trim()



    if (

      !STAGES.some((stage) => stage === newStage) ||

      (newStage === application.stage && normalizedReason === savedReason)

    ) {

      return

    }

    setUpdatingStageId(application.application_id)

    setStageMessage('')

    setStageError('')

    try {

      const response = await fetch(

        `/api/v1/applications/${application.application_id}/stage`,

        {

          method: 'PATCH',

          credentials: 'include',

          headers: {

            'Content-Type': 'application/json',

          },

          body: JSON.stringify({

            stage: newStage,

            reason: reason.trim() || null,

          }),

        },

      )

      if (!response.ok) {

        const data = await response.json().catch(() => null)

        throw new Error(

          data?.detail || 'Failed to update candidate stage.',

        )

      }

      const updatedApplication: Application = {

        ...application,

        stage: newStage,

        stage_reason: reason.trim() || null,

      }

      setApplications((previous) =>

        previous.map((item) =>

          item.application_id === application.application_id

            ? updatedApplication

            : item,

        ),

      )

      setSelected((previous) =>

        previous?.application_id === application.application_id

          ? updatedApplication

          : previous,

      )

      setStageMessage(

        `${application.candidate_name ?? application.name ?? 'Unknown candidate'}'s stage updated to ${newStage}.`,

      )

      setStageReason(normalizedReason)

      setHistoryRefresh((previous) => previous + 1)

    } catch (err) {

      setStageError(

        err instanceof Error

          ? err.message

          : 'Unable to update candidate stage.',

      )

    } finally {

      setUpdatingStageId(null)

    }

  }

const filteredApplications = applications.filter((application) => {

  const query = search.toLowerCase()

  const name = (

    application.candidate_name ?? application.name ?? 'Unknown candidate'

  ).toLowerCase()

  const email = (

    application.candidate_email ?? application.email ?? ''

  ).toLowerCase()

  const resume = (application.resume_filename ?? '').toLowerCase()

  const stage = (application.stage ?? '').toLowerCase()



  return (

    name.includes(query) ||

    email.includes(query) ||

    resume.includes(query) ||

    stage.includes(query)

  )

})

const screenedCount = applications.filter(

    (application) => application.screening_status === 'Completed',

  ).length

  const shortlistedCount = applications.filter(

    (application) => application.stage === 'Shortlisted',

  ).length

  return (

    <div className="mx-auto max-w-7xl space-y-7">

      <section>

        <button

          type="button"

          onClick={() => window.history.back()}

          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"

        >

          <ArrowLeft size={17} />

          Back

        </button>

        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

          <div>

            <p className="text-sm font-semibold text-blue-600">

              HR workspace

            </p>

            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">

              Candidate screening

            </h2>

            <p className="mt-2 text-sm text-slate-500">

              Review applications, screening results, and hiring stages.

            </p>

          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">

            {screenedCount} of {applications.length} applications screened

          </div>

        </div>

      </section>

      <section className="grid gap-4 sm:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5">

          <p className="text-sm text-slate-500">Total applications</p>

          <p className="mt-1 text-2xl font-bold text-slate-900">

            {applications.length}

          </p>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">

          <p className="text-sm text-slate-500">Screening completed</p>

          <p className="mt-1 text-2xl font-bold text-slate-900">

            {screenedCount}

          </p>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">

          <p className="text-sm text-slate-500">Awaiting screening</p>

          <p className="mt-1 text-2xl font-bold text-slate-900">

            {applications.length - screenedCount}

          </p>

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">

          <p className="text-sm text-slate-500">Shortlisted</p>

          <p className="mt-1 text-2xl font-bold text-slate-900">

            {shortlistedCount}

          </p>

        </div>

      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h3 className="font-semibold text-slate-900">Applications</h3>

            <p className="mt-1 text-sm text-slate-500">

              Open a candidate to inspect AI screening results.

            </p>

          </div>

          <div className="relative">

            <Search

              size={16}

              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"

            />

            <input

              value={search}

              onChange={(event) => setSearch(event.target.value)}

              placeholder="Search candidates..."

              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-64"

            />

          </div>

        </div>

        {stageMessage && (

          <p

            role="status"

            className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm text-emerald-700"

          >

            {stageMessage}

          </p>

        )}

        {stageError && (

          <p

            role="alert"

            className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700"

          >

            {stageError}

          </p>

        )}

        {loading ? (

          <p className="p-8 text-center text-sm text-slate-500">

            Loading applications...

          </p>

        ) : error && !selected ? (

          <p className="p-8 text-center text-sm text-red-600">{error}</p>

        ) : filteredApplications.length === 0 ? (

          <p className="p-8 text-center text-sm text-slate-500">

            No applications found.

          </p>

        ) : (

          <div className="divide-y divide-slate-100">

            {filteredApplications.map((application, index) => (

              <div

                key={application.application_id}

                className="flex w-full flex-col gap-4 p-5 transition hover:bg-slate-50 lg:flex-row lg:items-center"

              >

                <div className="flex min-w-0 items-center gap-4 lg:w-64">

                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">

                    \#{index + 1}

                  </span>

                  <div className="min-w-0">

                    <button

                      type="button"

                      onClick={() => openCandidate(application)}

                      className="text-left font-semibold text-slate-900 hover:text-blue-600"

                    >

                      {application.candidate_name ?? application.name ?? 'Unknown candidate'}

                    </button>

                    <p className="mt-1 truncate text-xs text-slate-400">

                      {application.candidate_email ?? application.email ?? 'No email provided'}

                    </p>

                    <p className="mt-1 text-xs text-slate-400">

                      Application #{application.application_id}

                    </p>

                  </div>

                </div>

                <div className="flex items-center gap-3 lg:w-40">

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-blue-100 text-sm font-bold text-blue-700">

                    {application.score ?? '—'}

                  </div>

                  <div>

                    <p className="text-xs text-slate-400">Screening score</p>

                    <span

                      className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${

                        application.screening_status === 'Completed'

                          ? 'bg-emerald-50 text-emerald-700'

                          : 'bg-amber-50 text-amber-700'

                      }`}

                    >

                      {application.screening_status}

                    </span>

                  </div>

                </div>

                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm text-slate-600">

                    {application.resume_filename}

                  </p>

                  <p className="mt-1 text-xs text-slate-400">

                    Current stage: {application.stage}

                  </p>

                  {application.stage_reason && (

                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">

                      Decision: {application.stage_reason}

                    </p>

                  )}

                </div>

                {isHR && (
                <div className="flex shrink-0 flex-col gap-1">

                  <label

                    htmlFor={`stage-${application.application_id}`}

                    className="text-xs font-medium text-slate-500"

                  >

                    Update stage

                  </label>

                  <select

                    id={`stage-${application.application_id}`}

                    value={application.stage}

                    disabled={updatingStageId === application.application_id}

                    onChange={(event) =>

                      updateCandidateStage(application, event.target.value)

                    }

                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"

                  >

                    {STAGES.map((stage) => (

                      <option key={stage} value={stage}>

                        {stage}

                      </option>

                    ))}

                  </select>

                  {updatingStageId === application.application_id && (

                    <span className="text-xs text-blue-600">Saving...</span>

                  )}

                </div>

                )}

                <button

                  type="button"

                  onClick={() => openCandidate(application)}

                  aria-label={`View screening details for ${application.candidate_name ?? application.name ?? 'Unknown candidate'}`}

                  className="flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"

                >

                  <ChevronRight size={19} />

                </button>

              </div>

            ))}

          </div>

        )}

      </section>

      {selected && (

        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm">

          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">

                  Application #{selected.application_id}

                </p>

                <h3 className="mt-1 text-xl font-bold text-slate-900">

                  {selected.candidate_name ?? selected.name ?? 'Unknown candidate'}

                </h3>

                <p className="mt-1 text-sm text-slate-500">

                  {selected.candidate_email ?? selected.email ?? 'No email provided'}

                </p>

              </div>

              <button

                type="button"

                onClick={() => {

                  setSelected(null)

                  setScreening(null)

                  setError('')

                }}

                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"

                aria-label="Close candidate details"

              >

                <X size={19} />

              </button>

            </div>

            <div className="space-y-6 p-6">

              {isHR && (
              <section className="rounded-xl border border-slate-200 p-4">

                <p className="text-sm font-semibold text-slate-800">

                  Hiring stage

                </p>

                <select

                  aria-label="Update selected candidate hiring stage"

                  value={selected.stage}

                  disabled={updatingStageId === selected.application_id}

                  onChange={(event) =>

                    updateCandidateStage(selected, event.target.value, stageReason)

                  }

                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"

                >

                  {STAGES.map((stage) => (

                    <option key={stage} value={stage}>

                      {stage}

                    </option>

                  ))}

                </select>

                {updatingStageId === selected.application_id && (

                  <p className="mt-2 text-xs text-blue-600">Saving stage...</p>

                )}

                {stageMessage && (

                  <p role="status" className="mt-2 text-sm text-emerald-700">

                    {stageMessage}

                  </p>

                )}

                {stageError && (

                  <p role="alert" className="mt-2 text-sm text-red-600">

                    {stageError}

                  </p>

                )}

                <label

                  htmlFor="stage-reason"

                  className="mt-4 block text-sm font-medium text-slate-700"

                >

                  Decision reason (optional)

                </label>

                <textarea

                  id="stage-reason"

                  value={stageReason}

                  onChange={(event) => setStageReason(event.target.value)}

                  rows={3}

                  maxLength={2000}

                  placeholder="Add a brief reason for this hiring-stage decision..."

                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"

                />

                <button

                  type="button"

                  disabled={updatingStageId === selected.application_id}

                  onClick={() =>

                    updateCandidateStage(selected, selected.stage, stageReason)

                  }

                  className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"

                >

                  Save decision reason

                </button>

              </section>

              )}

              <section className="rounded-xl border border-slate-200 p-4">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <h4 className="font-semibold text-slate-900">AI screening</h4>

                    <p className="mt-1 text-sm text-slate-500">

                      Run or refresh the evidence-based screening for this application.

                    </p>

                  </div>

                  <button

                    type="button"

                    disabled={

                      screeningRunning || detailLoading ||

                      screening?.requirements_confirmed === false

                    }

                    onClick={() => runScreening(selected)}

                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    <Sparkles size={16} />

                    {screeningRunning ? 'Screening...' : 'Run screening'}

                  </button>

                </div>

                {screening?.requirements_confirmed === false && (

                  <p className="mt-3 text-sm text-amber-800">

                    Confirm the job requirements before running screening.

                  </p>

                )}

                {screeningActionMessage && (

                  <p role="status" className="mt-3 text-sm text-emerald-700">

                    {screeningActionMessage}

                  </p>

                )}

                {screeningActionError && (

                  <p role="alert" className="mt-3 text-sm text-red-700">

                    {screeningActionError}

                  </p>

                )}

              </section>

<section className="rounded-xl border border-slate-200 p-4">

  <h4 className="font-semibold text-slate-900">

    Application history

  </h4>

  {historyLoading ? (

    <p className="mt-3 text-sm text-slate-500">

      Loading history...

    </p>

  ) : historyError ? (

    <p role="alert" className="mt-3 text-sm text-red-600">

      {historyError}

    </p>

  ) : history.length === 0 ? (

    <p className="mt-3 text-sm text-slate-500">

      No history recorded yet. Future stage changes will appear here.

    </p>

  ) : (

    <div className="mt-4 space-y-4">

      {history.map((event) => (

        <div key={event.id} className="flex gap-3">

          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />

          <div className="min-w-0">

            <p className="text-sm font-medium text-slate-800">

              {event.event_type}

            </p>

            {event.description && (

              <p className="mt-1 text-sm text-slate-600">

                {event.description}

              </p>

            )}

            <p className="mt-1 text-xs text-slate-400">

              {new Date(event.created_at).toLocaleString()}

            </p>

          </div>

        </div>

      ))}

    </div>

  )}

</section>

              {detailLoading ? (

                <p className="py-8 text-center text-sm text-slate-500">

                  Loading screening details...

                </p>

              ) : error ? (

                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">

                  {error}

                </p>

              ) : screening ? (

                <>

                  {screening.results_current === false && (

                    <div

                      role="alert"

                      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"

                    >

                      <p className="font-semibold">

                        Screening results are not current

                      </p>

                      <p className="mt-1">

                        {screening.results_message ||

                          'Confirm the current job requirements and screen this application again before relying on these results.'}

                      </p>

                    </div>

                  )}

                  {screening.requirements_confirmed === false && (

                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">

                      Job requirements are currently unconfirmed. Confirm them

                      before running screening again.

                    </div>

                  )}

                  <div className="grid gap-3 sm:grid-cols-2">

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-medium text-slate-500">

                        AI screening verdict

                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">

                        {screening.verdict || 'Pending review'}

                      </p>

                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-medium text-slate-500">

                        Screening status

                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-900">

                        {screening.screening_status}

                      </p>

                    </div>

                  </div>

                  {screening.stage_reason && (

                    <div className="rounded-xl border border-slate-200 p-4">

                      <p className="text-xs font-medium text-slate-500">

                        Latest HR decision reason

                      </p>

                      <p className="mt-1 text-sm text-slate-800">

                        {screening.stage_reason}

                      </p>

                    </div>

                  )}

                  <div className="rounded-2xl bg-slate-950 p-6 text-white">

                    <div className="flex items-center justify-between gap-4">

                      <div>

                        <p className="text-sm text-slate-400">

                          Overall screening score

                        </p>

                        <p className="mt-1 text-4xl font-bold">

                          {screening.score ?? '—'}

                          <span className="text-lg text-slate-500">/100</span>

                        </p>

                      </div>

                      <Sparkles className="text-blue-400" size={28} />

                    </div>

                    {screening.score !== null && (

                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">

                        <div

                          className="h-full rounded-full bg-blue-500"

                          style={{

                            width: `${Math.max(

                              0,

                              Math.min(100, screening.score),

                            )}%`,

                          }}

                        />

                      </div>

                    )}

                  </div>

                  <div

                    className={`rounded-xl border p-4 ${

                      screening.must_have_requirements_met

                        ? 'border-emerald-200 bg-emerald-50'

                        : 'border-amber-200 bg-amber-50'

                    }`}

                  >

                    <div className="flex items-center gap-2 font-semibold text-slate-800">

                      <ShieldCheck size={19} />

                      Must-have requirements

                    </div>

                    <p className="mt-2 text-sm text-slate-700">

                      {screening.must_have_requirements_met

                        ? 'All assessed Must-have requirements are met.'

                        : 'One or more Must-have requirements need HR review.'}

                    </p>

                    {screening.unmet_must_have_requirements.length > 0 && (

                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">

                        {screening.unmet_must_have_requirements.map((item) => (

                          <li key={item.requirement_id}>

                            {item.requirement} — {item.assessment}

                          </li>

                        ))}

                      </ul>

                    )}

                    {(screening.missing_must_haves?.length ?? 0) > 0 && (

                      <div className="mt-4 border-t border-amber-200 pt-3">

                        <p className="text-sm font-semibold text-slate-800">

                          Saved Must-have review flags

                        </p>

                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">

                          {screening.missing_must_haves?.map((item) => (

                            <li key={item.requirement_id}>

                              {item.requirement} — {item.assessment}

                            </li>

                          ))}

                        </ul>

                      </div>

                    )}

                  </div>

                  <section>

                    <h4 className="font-semibold text-slate-900">

                      Requirement assessments

                    </h4>

                    <div className="mt-3 space-y-4">

                      {screening.requirements.map((requirement) => (

                        <article

                          key={requirement.requirement_id}

                          className="rounded-xl border border-slate-200 p-4"

                        >

                          <div className="flex flex-wrap items-start justify-between gap-2">

                            <div>

                              <h5 className="font-semibold text-slate-900">

                                {requirement.requirement_text}

                              </h5>

                              <p className="mt-1 text-xs text-slate-500">

                                {requirement.requirement_type} · Weight{' '}

                                {requirement.weight}

                              </p>

                            </div>

                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">

                              {requirement.assessment ?? 'Not assessed'}

                            </span>

                          </div>

                          <p className="mt-3 text-sm leading-6 text-slate-600">

                            {requirement.explanation ||

                              'No explanation available.'}

                          </p>

                          <p className="mt-3 text-sm font-semibold text-slate-800">

                            Scoring credit: {requirement.match_ratio * 100}%

                          </p>

                          {requirement.evidence.length > 0 && (

                            <div className="mt-4">

                              <p className="text-sm font-semibold text-emerald-700">

                                Evidence found

                              </p>

                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">

                                {requirement.evidence.map((item, index) => (

                                  <li

                                    key={`${requirement.requirement_id}-e-${index}`}

                                  >

                                    {item}

                                  </li>

                                ))}

                              </ul>

                            </div>

                          )}

                          {requirement.missing_information.length > 0 && (

                            <div className="mt-4">

                              <p className="text-sm font-semibold text-amber-700">

                                Missing information

                              </p>

                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">

                                {requirement.missing_information.map(

                                  (item, index) => (

                                    <li

                                      key={`${requirement.requirement_id}-m-${index}`}

                                    >

                                      {item}

                                    </li>

                                  ),

                                )}

                              </ul>

                            </div>

                          )}

                          {requirement.confidence !== null && (

                            <p className="mt-4 text-xs text-slate-400">

                              AI-reported confidence:{' '}

                              {Math.round(requirement.confidence * 100)}%

                            </p>

                          )}

                        </article>

                      ))}

                    </div>

                  </section>

                  <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">

                    AI screening is decision support only. Confidence is a

                    model-reported estimate, not a verified probability. HR

                    retains responsibility for all hiring decisions.

                  </div>

                </>

              ) : (

                <p className="text-sm text-slate-500">

                  No saved screening results are available for this application.

                </p>

              )}

            </div>

          </div>

        </div>

      )}

    </div>

  )

}
