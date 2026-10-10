import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
  ArrowLeft,
  Check,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'

interface Requirement {
  id: number
  text: string
  kind: 'Must-have' | 'Nice-to-have'
  weight: number
}

interface ApiRequirement {
  id: number
  job_id: number
  text: string
  requirement_type: 'Must-have' | 'Nice-to-have'
  weight: number
  sort_order: number
}

export default function RequirementsPage() {
  const { id } = useParams<{ id: string }>()
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
useEffect(() => {
  const loadRequirements = async () => {
    try {

const [requirementsResponse, jobResponse] = await Promise.all([
  fetch(`/api/v1/jobs/${id}/requirements`, {
    credentials: 'include',
  }),
  fetch(`/api/v1/jobs/${id}`, {
    credentials: 'include',
  }),
])


      if (!requirementsResponse.ok) {
        throw new Error('Failed to load requirements')
      }

      if (!jobResponse.ok) {
        throw new Error('Failed to load job')
      }

      const data: ApiRequirement[] =
        await requirementsResponse.json()

      const job = await jobResponse.json()

      setRequirements(
        data.map((requirement) => ({
          id: requirement.id,
          text: requirement.text,
          kind: requirement.requirement_type,
          weight: requirement.weight,
        })),
      )

      setConfirmed(job.requirements_confirmed)
    } catch (error) {
      console.error('Failed to load requirements:', error)
    } finally {
      setLoading(false)
    }
  }

  loadRequirements()
}, [])

  const updateRequirement = async (
  id: number,
  field: keyof Requirement,
  value: string | number,
) => {
  const updatedRequirements = requirements.map((requirement) =>
    requirement.id === id
      ? { ...requirement, [field]: value }
      : requirement,
  )

  setRequirements(updatedRequirements)

  const updatedRequirement = updatedRequirements.find(
    (requirement) => requirement.id === id,
  )

  if (!updatedRequirement) {
    return
  }

  try {
    const response = await fetch(
      `/api/v1/requirements/${id}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: updatedRequirement.text,
          requirement_type: updatedRequirement.kind,
          weight: updatedRequirement.weight,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to update requirement')
    }

    console.log('Requirement updated successfully')
  } catch (error) {
    console.error('Failed to update requirement:', error)
  }
}

 const removeRequirement = async (id: number) => {
  try {
    const response = await fetch(
      `/api/v1/requirements/${id}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )

    if (!response.ok) {
      throw new Error('Failed to delete requirement')
    }

    setRequirements((current) =>
      current.filter((requirement) => requirement.id !== id),
    )

    console.log('Requirement deleted successfully')
  } catch (error) {
    console.error('Failed to delete requirement:', error)
  }
}

  const addRequirement = async () => {
  try {
    const response = await fetch(
      '`/api/v1/jobs/${id}/requirements`',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'New requirement',
          requirement_type: 'Nice-to-have',
          weight: 1,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to add requirement')
    }

    const data: ApiRequirement = await response.json()

    setRequirements((current) => [
      ...current,
      {
        id: data.id,
        text: data.text,
        kind: data.requirement_type,
        weight: data.weight,
      },
    ])

    console.log('Requirement added successfully')
  } catch (error) {
    console.error('Failed to add requirement:', error)
  }
}

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading requirements...
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      {/* Header */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft size={17} />
            Back to jobs
          </button>

          <p className="text-sm font-semibold text-blue-600">
            Senior Software Engineer
          </p>

          <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Review requirements
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Review the requirements drafted from the job description.
            Edit them before confirming the criteria used for screening.
          </p>
        </div>

        {confirmed && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            <Check size={17} />
            Requirements confirmed
          </div>
        )}
      </section>

      {/* AI banner */}
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Sparkles size={19} />
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">
              AI-generated requirements
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              These requirements were drafted from the job description.
              Review and adjust them before screening candidates.
            </p>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="font-semibold text-slate-900">
              Screening criteria
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {requirements.length} requirements
            </p>
          </div>

          <button
            onClick={addRequirement}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {requirements.map((requirement, index) => (
            <div
              key={requirement.id}
              className="group p-5 transition hover:bg-slate-50/70 sm:p-6"
            >
              <div className="flex gap-4">
                <div className="hidden pt-3 text-slate-300 sm:block">
                  <GripVertical size={18} />
                </div>

                <div className="flex-1 space-y-4">
                  {/* Requirement input */}
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                      {index + 1}
                    </span>

                    <input
                      value={requirement.text}
                      onChange={(event) =>
                        updateRequirement(
                          requirement.id,
                          'text',
                          event.target.value,
                        )
                      }
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    />

                    <button
                      onClick={() =>
                        removeRequirement(requirement.id)
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap items-center gap-3 pl-11">
                    <select
                      value={requirement.kind}
                      onChange={(event) =>
                        updateRequirement(
                          requirement.id,
                          'kind',
                          event.target.value as
                            | 'Must-have'
                            | 'Nice-to-have',
                        )
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold outline-none ${
                        requirement.kind === 'Must-have'
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <option>Must-have</option>
                      <option>Nice-to-have</option>
                    </select>

                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      Weight

                      <select
                        value={requirement.weight}
                        onChange={(event) =>
                          updateRequirement(
                            requirement.id,
                            'weight',
                            Number(event.target.value),
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                      >
                        {[1, 2, 3, 4, 5].map((weight) => (
                          <option key={weight} value={weight}>
                            {weight}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Ready to screen?
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Once confirmed, these criteria will be used for candidate screening.
            </p>
          </div>

          <button
            onClick={async () => {
  try {
    const response = await fetch(
      '`/api/v1/jobs/${id}/requirements`/confirm',
      {
        method: 'POST',
        credentials: 'include',
      },
    )

    if (!response.ok) {
      throw new Error('Failed to confirm requirements')
    }

    setConfirmed(true)
    console.log('Requirements confirmed successfully')
  } catch (error) {
    console.error('Failed to confirm requirements:', error)
  }
}}
            disabled={confirmed}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-default disabled:bg-emerald-600"
          >
            {confirmed ? (
              <>
                <Check size={17} />
                Confirmed
              </>
            ) : (
              <>
                Confirm requirements
                <Check size={17} />
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  )
}
