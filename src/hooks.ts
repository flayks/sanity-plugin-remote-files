import {useToast} from '@sanity/ui/toast'
import {useState} from 'react'
import {useClient} from 'sanity'

import {uploadRemoteFile} from './api'
import {getFileMetadata} from './metadata'
import type {RemoteFileDocument, RemoteFilesProvider} from './types'

export type UploadProgress = {
  fileName: string
  progress?: number
  stage: 'uploading' | 'saving'
}

/**
 * GROQ projection shared by the browser and field input.
 * Keep in sync with the `remoteFiles.file` schema fields.
 */
export const REMOTE_FILE_PROJECTION =
  '{_id, _type, title, description, poster, "posterUrl": poster.asset->url, filename, key, url, provider, contentType, duration, height, size, uploadedAt, width}'

/**
 * Upload a file to the provider and create a Sanity document for it.
 * Handles upload, metadata extraction, document creation, and toast feedback.
 * Returns the created document (or undefined on failure).
 */
export function useRemoteFileUpload(provider?: RemoteFilesProvider) {
  const client = useClient({apiVersion: '2025-01-01'})
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)

  async function upload(file: File): Promise<RemoteFileDocument | undefined> {
    if (!provider) return undefined

    setUploading(true)
    setUploadProgress({
      fileName: file.name,
      progress: provider.uploadFile ? undefined : 0,
      stage: 'uploading',
    })
    try {
      // Upload to provider and extract client-side metadata in parallel
      const [result, metadata] = await Promise.all([
        uploadRemoteFile(provider, file, (progress) => {
          setUploadProgress({fileName: file.name, progress, stage: 'uploading'})
        }),
        getFileMetadata(file),
      ])

      setUploadProgress({fileName: result.filename || file.name, progress: 100, stage: 'saving'})
      const created = await client.create<Omit<RemoteFileDocument, '_id'>>({
        _type: 'remoteFiles.file',
        title: result.filename,
        duration: result.duration ?? metadata.duration,
        filename: result.filename,
        height: result.height ?? metadata.height,
        key: result.key,
        url: result.url,
        provider: provider.id,
        contentType: result.contentType || file.type,
        size: result.size || file.size,
        uploadedAt: new Date().toISOString(),
        width: result.width ?? metadata.width,
      })
      const document: RemoteFileDocument = {...created, _type: 'remoteFiles.file'}

      toast.push({status: 'success', title: 'File uploaded'})
      return document
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : String(error),
      })
      return undefined
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  return {upload, uploading, uploadProgress}
}
