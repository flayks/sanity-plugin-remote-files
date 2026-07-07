import {createRemoteFilesProvider} from './createProvider'
import type {RemoteFileDocument, RemoteFilesProvider, UploadResult} from '../types'

/** Response expected from your signed URL endpoint. */
/** @public */
export type SignedUploadUrlResult = {
  /** Short-lived URL used by the browser to upload the file. */
  uploadUrl: string
  /** Final object key stored by the provider. */
  key: string
  /** Public/read URL for the uploaded file. */
  url: string
  /** Optional method for the signed request. Defaults to PUT. */
  method?: 'PUT' | 'POST'
  /** Optional headers required by the signed request. */
  headers?: HeadersInit
}

/** @public */
export type SignedUrlProviderConfig = Omit<
  RemoteFilesProvider,
  'title' | 'endpoint' | 'uploadFile' | 'deleteFile' | 'uploadFields'
> & {
  getUploadUrlEndpoint: string
  deleteEndpoint: string
  title?: string
}

/**
 * Generic signed URL provider.
 *
 * Your backend returns a short-lived upload URL. The browser uploads directly
 * to storage with that URL, so storage credentials never enter the Studio.
 */
/** @public */
export function signedUrlProvider(config: SignedUrlProviderConfig): RemoteFilesProvider {
  const {deleteEndpoint, getUploadUrlEndpoint, headers, ...providerConfig} = config

  return createRemoteFilesProvider(
    {
      ...providerConfig,
      headers,
      async uploadFile(file, {onProgress}) {
        const signed = await getSignedUploadUrl(getUploadUrlEndpoint, headers, file)
        await uploadToSignedUrl(signed, file, onProgress)

        return {
          key: signed.key,
          url: signed.url,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }
      },
      async deleteFile(file) {
        const endpoint = deleteEndpoint.replace(/\/$/, '')
        const response = await fetch(`${endpoint}/files/${encodeURIComponent(file.key)}`, {
          method: 'DELETE',
          headers,
        })
        if (!response.ok) {
          throw new Error(`Delete failed at ${endpoint}/files/${file.key} (${response.status}). ${await response.text()}`)
        }
      },
    },
    {title: config.title || 'Signed URL'},
  )
}

async function getSignedUploadUrl(endpoint: string, headers: HeadersInit | undefined, file: File) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/json', ...Object.fromEntries(new Headers(headers || {}).entries())},
    body: JSON.stringify({filename: file.name, contentType: file.type, size: file.size}),
  })

  if (!response.ok) {
    throw new Error(`Could not get signed upload URL (${response.status}). ${await response.text()}`)
  }

  return (await response.json()) as SignedUploadUrlResult
}

function uploadToSignedUrl(
  signed: SignedUploadUrlResult,
  file: File,
  onProgress?: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Signed upload failed (${request.status}). ${request.responseText}`))
        return
      }
      resolve()
    }

    request.onerror = () => reject(new Error('Signed upload failed.'))
    request.open(signed.method || 'PUT', signed.uploadUrl)
    new Headers(signed.headers || {}).forEach((value, key) => request.setRequestHeader(key, value))
    if (!signed.headers || !new Headers(signed.headers).has('content-type')) {
      request.setRequestHeader('content-type', file.type || 'application/octet-stream')
    }
    request.send(file)
  })
}
