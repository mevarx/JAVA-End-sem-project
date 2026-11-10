export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export const UNAUTHORIZED_EVENT = 'haes:unauthorized'

interface RequestOptions {
  method?: string
  body?: unknown
  formData?: FormData
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {},
  }
  if (options.formData) {
    init.body = options.formData
  } else if (options.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(options.body)
  }

  const response = await fetch(`/api${path}`, init)
  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    const message =
      (parsed as { message?: string } | null)?.message ??
      (parsed as { error?: string } | null)?.error ??
      response.statusText
    throw new ApiError(response.status, message)
  }
  return parsed as T
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', formData }),
}

/** Downloads a file endpoint (CSV exports) using the same session cookie. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: 'include' })
  if (!response.ok) {
    const text = await response.text()
    let message = response.statusText
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? message
    } catch {
      // The body was not JSON; keep the status text.
    }
    throw new ApiError(response.status, message)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  const name = match?.[1] ?? fallbackName
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
