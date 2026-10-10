import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { apiFetch } from '../api'

type UploadStatus = 'Queued' | 'Processing' | 'Done' | 'Failed'

interface ResumeFile {
  id: number
  file: File
  name: string
  size: string
  status: UploadStatus
  message?: string
  applicationId?: number
}

export default function ResumeUploadPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [files, setFiles] = useState<ResumeFile[]>([])
  const [dragging, setDragging] = useState(false)

  const handleFile = (file: File | null) => {
    setUploadError('')
    setUploadSuccess('')
    if (!file) return

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (
      !allowedTypes.includes(file.type) ||
      !/\.(pdf|docx)$/i.test(file.name)
    ) {
      setSelectedFile(null)
      setUploadError('Choose a PDF or DOCX resume.')
      return
    }

    if (file.size === 0) {
      setSelectedFile(null)
      setUploadError('The selected file is empty.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null)
      setUploadError('Resume must be 5 MB or smaller.')
      return
    }

    setSelectedFile(file)
  }

  const uploadResume = async () => {
    setUploadError('')
    setUploadSuccess('')

    if (!id || !/^\d+$/.test(id)) {
      setUploadError('The job ID is missing or invalid. Return to Jobs and open the job again.')
      return
    }

    if (!candidateName.trim() || !candidateEmail.trim()) {
      setUploadError('Enter the candidate name and email.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail.trim())) {
      setUploadError('Enter a valid candidate email address.')
      return
    }

    if (!selectedFile) {
      setUploadError('Choose a PDF or DOCX resume first.')
      return
    }

    setUploading(true)
    const queueId = Date.now()

    setFiles((current) => [
      ...current,
      {
        id: queueId,
        file: selectedFile,
        name: selectedFile.name,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        status: 'Processing',
      },
    ])

    try {
      const formData = new FormData()
      formData.append('candidate_name', candidateName.trim())
      formData.append('candidate_email', candidateEmail.trim())
      formData.append('resume', selectedFile)

      const response = await apiFetch(`/api/v1/jobs/${id}/applications`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        const detail =
          typeof result.detail === 'string'
            ? result.detail
            : result.detail?.message || `Upload failed (${response.status}).`
        throw new Error(detail)
      }

      setFiles((current) =>
        current.map((item) =>
          item.id === queueId
            ? {
                ...item,
                status: 'Done',
                applicationId: result.application_id,
                message: 'Uploaded; screening queued',
              }
            : item,
        ),
      )
      setUploadSuccess(
        `Resume uploaded successfully. Application ID: ${result.application_id}. Screening has been queued.`,
      )
      setCandidateName('')
      setCandidateEmail('')
      setSelectedFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not upload resume.'
      setFiles((current) =>
        current.map((item) =>
          item.id === queueId
            ? { ...item, status: 'Failed', message }
            : item,
        ),
      )
      setUploadError(message)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (idToRemove: number) => {
    setFiles((current) => current.filter((file) => file.id !== idToRemove))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <section>
        <button
          type="button"
          onClick={() => navigate(`/jobs/${id}/requirements`)}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back to requirements
        </button>

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-600">Job ID: {id}</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Upload resumes
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Upload one candidate resume at a time. Each successful upload
              creates an application and queues screening against the confirmed
              job requirements.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={17} />
            Requirements confirmed
          </div>
        </div>
      </section>

      <section className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Sparkles size={19} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Evidence-grounded screening</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The backend will validate and save the resume, create an application,
            and queue the existing screening pipeline.
          </p>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Candidate details</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Candidate name</span>
            <input
              value={candidateName}
              onChange={(event) => setCandidateName(event.target.value)}
              autoComplete="name"
              placeholder="e.g. Aarav Sharma"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Candidate email</span>
            <input
              type="email"
              value={candidateEmail}
              onChange={(event) => setCandidateEmail(event.target.value)}
              autoComplete="email"
              placeholder="e.g. aarav@example.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            handleFile(event.dataTransfer.files?.[0] ?? null)
          }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
            dragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Upload size={25} />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Upload candidate resume
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Drag and drop a PDF or DOCX resume here, or choose a file from your computer.
          </p>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            Choose resume
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0] ?? null)
            }}
          />
          <p className="mt-3 text-xs text-slate-400">PDF or DOCX · Maximum 5 MB</p>

          {selectedFile && (
            <div className="mx-auto mt-5 flex max-w-lg items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left">
              <FileText className="shrink-0 text-blue-600" size={22} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
                aria-label="Remove selected resume"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {uploadSuccess}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Upload each candidate separately with their own name, email and resume.
          </p>
          <button
            type="button"
            onClick={uploadResume}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload size={17} />
                Upload and queue screening
              </>
            )}
          </button>
        </div>
      </section>

      {files.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="font-semibold text-slate-900">Upload history</h3>
            <p className="mt-1 text-sm text-slate-500">
              {files.length} upload attempt{files.length !== 1 ? 's' : ''} in this session
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {file.size} · {file.status}
                    {file.applicationId ? ` · Application #${file.applicationId}` : ''}
                  </p>
                  {file.message && <p className="mt-1 text-xs text-slate-600">{file.message}</p>}
                </div>
                {file.status === 'Processing' && <Loader2 size={17} className="animate-spin text-blue-600" />}
                {file.status === 'Done' && <CheckCircle2 size={18} className="text-emerald-600" />}
                {file.status === 'Failed' && (
                  <button
                    type="button"
                    onClick={() => removeFile(file.id)}
                    aria-label="Dismiss failed upload"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
