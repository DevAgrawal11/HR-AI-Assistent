const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export function apiFetch(path: string, options: RequestInit = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    credentials: options.credentials ?? 'include',
  })
}
