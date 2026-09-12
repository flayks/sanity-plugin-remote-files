import type {
  RemoteFileDocument,
  RemoteFileUploadProgress,
  RemoteFilesProvider,
  UploadResult,
} from './types'

type XhrUploadOptions = {
  url: string
  body: XMLHttpRequestBodyInit
  headers?: HeadersInit
  method?: string
  timeout?: number
  onProgress?: RemoteFileUploadProgress
  /** Prefixes the error message of every failure mode. */
  label: string
}

/**
 * Upload a body with XMLHttpRequest, which unlike fetch() reports progress.
 * Rejects on every terminal state, so a stalled request can never hang the UI.
 */
export function xhrUpload({
  url,
  body,
  headers,
  method = 'POST',
  timeout,
  onProgress,
  label,
}: XhrUploadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    })

    request.addEventListener('load', () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`${label} failed (${request.status}). ${request.responseText}`))
        return
      }
      resolve(request.responseText)
    })

    request.addEventListener('error', () => reject(new Error(`${label} could not reach ${url}.`)))
    request.addEventListener('timeout', () => reject(new Error(`${label} timed out.`)))
    request.addEventListener('abort', () => reject(new Error(`${label} was cancelled.`)))

    request.open(method, url)
    if (timeout) request.timeout = timeout
    if (headers) {
      new Headers(headers).forEach((value, key) => {
        request.setRequestHeader(key, value)
      })
    }
    request.send(body)
  })
}

/** `DELETE <endpoint>/files/:key`, shared by the endpoint and signed URL flows. */
export async function deleteAtEndpoint(endpoint: string, key: string, headers?: HeadersInit) {
  const base = endpoint.replace(/\/$/, '')
  const response = await fetch(`${base}/files/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers,
  })

  if (!response.ok) {
    throw new Error(
      `Delete failed at ${base}/files/${key} (${response.status}). ${await response.text()}`,
    )
  }
}

function parseUploadResponse(text: string): UploadResult {
  try {
    const parsed: UploadResult = JSON.parse(text)
    return parsed
  } catch {
    throw new Error('Upload endpoint returned invalid JSON.')
  }
}

function getPublicUrl(provider: RemoteFilesProvider, key: string, fallback: string) {
  if (!provider.publicUrl) return fallback
  return `${provider.publicUrl.replace(/\/$/, '')}/${key.replace(/^\/+/, '')}`
}

/**
 * Upload a file to the provider's endpoint.
 * The endpoint must accept multipart/form-data with a `file` field
 * and return `{ key, url, filename, contentType?, size?, duration?, width?, height? }`.
 */
export async function uploadRemoteFile(
  provider: RemoteFilesProvider,
  file: File,
  onProgress?: RemoteFileUploadProgress,
): Promise<UploadResult> {
  if (provider.uploadFile) return provider.uploadFile(file, {onProgress})

  if (!provider.endpoint) {
    throw new Error(
      `Remote files provider "${provider.id}" needs either an endpoint or an uploadFile() handler.`,
    )
  }

  const endpoint = provider.endpoint.replace(/\/$/, '')
  const body = new FormData()
  body.set('file', file)
  Object.entries(provider.uploadFields || {}).forEach(([key, value]) => body.set(key, value))

  const response = await xhrUpload({
    url: `${endpoint}/upload`,
    body,
    headers: provider.headers,
    timeout: provider.timeout,
    onProgress,
    label: 'Upload',
  })
  const result = parseUploadResponse(response)

  if (!result.key) throw new Error('Upload endpoint did not return a storage key.')

  return {
    ...result,
    url: getPublicUrl(provider, result.key, result.url),
    // Fall back to client-side values if the endpoint omits them
    contentType: result.contentType || file.type,
    filename: result.filename || file.name,
    size: result.size || file.size,
  }
}

/**
 * Delete a file from the provider's endpoint.
 * The endpoint must accept `DELETE /files/:key`.
 */
export async function deleteRemoteFile(
  provider: RemoteFilesProvider,
  file: RemoteFileDocument,
): Promise<void> {
  if (provider.deleteFile) return provider.deleteFile(file)

  if (!provider.endpoint) {
    throw new Error(
      `Remote files provider "${provider.id}" needs either an endpoint or a deleteFile() handler.`,
    )
  }

  return deleteAtEndpoint(provider.endpoint, file.key, provider.headers)
}
