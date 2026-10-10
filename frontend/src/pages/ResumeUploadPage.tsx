import { useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

type UploadStatus = 'Queued' | 'Processing' | 'Done' | 'Failed'

interface ResumeFile {
  id: number
  name: string
  size: string
  status: UploadStatus
  progress: number
}

export default function ResumeUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<ResumeFile[]>([])
  const [dragging, setDragging] = useState(false)

  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return

    const newFiles: ResumeFile[] = Array.from(selectedFiles)
      .filter(
        (file) =>
          file.type === 'application/pdf' ||
          file.type ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      .filter((file) => file.size <= 5 * 1024 * 1024)
      .map((file) => ({
        id: Date.now() + Math.random(),
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        status: 'Queued',
        progress: 0,
      }))

    setFiles((current) => [...current, ...newFiles])

    newFiles.forEach((file) => {
      setTimeout(() => {
        setFiles((current) =>
          current.map((item) =>
            item.id === file.id
              ? { ...item, status: 'Processing', progress: 55 }
              : item,
          ),
        )
      }, 800)

      setTimeout(() => {
        setFiles((current) =>
          current.map((item) =>
            item.id === file.id
              ? { ...item, status: 'Done', progress: 100 }
              : item,
          ),
        )
      }, 2200)
    })
  }

  const removeFile = (id: number) => {
    setFiles((current) =>
      current.filter((file) => file.id !== id),
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">

      {/* Header */}
      <section>
        <button className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={17} />
          Back to requirements
        </button>

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Senior Software Engineer
            </p>

            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Upload resumes
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Upload candidate resumes and let the screening pipeline
              evaluate them against the confirmed requirements.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={17} />
            Requirements confirmed
          </div>
        </div>
      </section>

      {/* AI info */}
      <section className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Sparkles size={19} />
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">
            Evidence-grounded screening
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Resumes will be screened against the confirmed requirements.
            Each result includes a score, verdict and evidence from the resume.
          </p>
        </div>
      </section>

      {/* Upload area */}
      <section
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Upload size={25} />
        </div>

        <h3 className="mt-5 text-lg font-semibold text-slate-900">
          Upload candidate resumes
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Drag and drop PDF or DOCX resumes here, or choose files
          from your computer.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
        >
          Choose files
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <p className="mt-4 text-xs text-slate-400">
          PDF or DOCX · Maximum 5 MB per file
        </p>
      </section>

      {/* Files */}
      {files.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="font-semibold text-slate-900">
              Screening queue
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {files.length} resume{files.length !== 1 ? 's' : ''} uploaded
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
                  <FileText size={20} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {file.name}
                  </p>

                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>{file.size}</span>
                    <span>•</span>
                    <span>{file.status}</span>
                  </div>

                  {file.status === 'Processing' && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {file.status === 'Queued' && (
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      Queued
                    </span>
                  )}

                  {file.status === 'Processing' && (
                    <span className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                      <Loader2 size={13} className="animate-spin" />
                      Processing
                    </span>
                  )}

                  {file.status === 'Done' && (
                    <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={13} />
                      Done
                    </span>
                  )}

                  {file.status === 'Failed' && (
                    <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                      Failed
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}