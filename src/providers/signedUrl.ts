import {deleteAtEndpoint, xhrUpload} from '../api'
import type {RemoteFilesProvider} from '../types'
import {createRemoteFilesProvider} from './createProvider'

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
        await xhrUpload({
          url: signed.uploadUrl,
          body: file,
          headers: signedUploadHeaders(signed, file),
          method: signed.method || 'PUT',
          timeout: config.timeout,
          onProgress,
          label: 'Signed upload',
        })

        return {
          key: signed.key,
          url: signed.url,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }
      },
      async deleteFile(file) {
        return deleteAtEndpoint(deleteEndpoint, file.key, headers)
      },
    },
    {title: config.title || 'Signed URL'},
  )
}

async function getSignedUploadUrl(endpoint: string, headers: HeadersInit | undefined, file: File) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(headers || {}).entries()),
    },
    body: JSON.stringify({filename: file.name, contentType: file.type, size: file.size}),
  })

  if (!response.ok) {
    throw new Error(
      `Could not get signed upload URL (${response.status}). ${await response.text()}`,
    )
  }

  const signed: SignedUploadUrlResult = await response.json()
  return signed
}

function signedUploadHeaders(signed: SignedUploadUrlResult, file: File) {
  const headers = new Headers(signed.headers || {})
  if (!headers.has('content-type')) {
    headers.set('content-type', file.type || 'application/octet-stream')
  }
  return headers
}
