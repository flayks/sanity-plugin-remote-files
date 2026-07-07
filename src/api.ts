import type {RemoteFileDocument, RemoteFileUploadProgress, RemoteFilesProvider, UploadResult} from './types'

function setRequestHeaders(request: XMLHttpRequest, headers?: HeadersInit) {
  if (!headers) return

  new Headers(headers).forEach((value, key) => {
    request.setRequestHeader(key, value)
  })
}

function parseUploadResponse(text: string): UploadResult {
  try {
    return JSON.parse(text) as UploadResult
  } catch {
    throw new Error('Upload endpoint returned invalid JSON.')
  }
}

/**
 * Upload a file to the provider's endpoint.
 * The endpoint must accept multipart/form-data with a `file` field
 * and return `{ key, url, filename, contentType?, size? }`.
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

  const result = await new Promise<UploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Upload failed at ${endpoint}/upload (${request.status}). ${request.responseText}`))
        return
      }

      try {
        resolve(parseUploadResponse(request.responseText))
      } catch (error) {
        reject(error)
      }
    }

    request.onerror = () => {
      reject(new Error(`Could not reach remote files endpoint: ${endpoint}.`))
    }

    request.open('POST', `${endpoint}/upload`)
    setRequestHeaders(request, provider.headers)
    request.send(body)
  })

  return {
    ...result,
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

  const endpoint = provider.endpoint.replace(/\/$/, '')
  const response = await fetch(
    `${endpoint}/files/${encodeURIComponent(file.key)}`,
    {method: 'DELETE', headers: provider.headers},
  )

  if (!response.ok) {
    throw new Error(`Delete failed at ${endpoint}/files/${file.key} (${response.status}). ${await response.text()}`)
  }
}
