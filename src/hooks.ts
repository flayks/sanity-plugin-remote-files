import {useToast} from '@sanity/ui'
import {useEffect, useState} from 'react'
import {useClient} from 'sanity'
import {uploadRemoteFile} from './api'
import {getFileMetadata, getRemoteDuration} from './metadata'
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
  '{_id, _type, title, description, filename, key, url, provider, contentType, duration, height, size, uploadedAt, width}'

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
    if (!provider) return

    setUploading(true)
    setUploadProgress({fileName: file.name, progress: provider.uploadFile ? undefined : 0, stage: 'uploading'})
    try {
      // Upload to provider and extract client-side metadata in parallel
      const [result, metadata] = await Promise.all([
        uploadRemoteFile(provider, file, (progress) => {
          setUploadProgress({fileName: file.name, progress, stage: 'uploading'})
        }),
        getFileMetadata(file),
      ])

      setUploadProgress({fileName: result.filename || file.name, progress: 100, stage: 'saving'})
      const document = (await client.create({
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
      })) as RemoteFileDocument

      toast.push({status: 'success', title: 'File uploaded'})
      return document
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  return {upload, uploading, uploadProgress}
}

/**
 * Lazily fetch video/audio duration from the remote URL when the
 * stored document doesn't have one yet. Best-effort: returns undefined
 * if the media can't be probed (CORS, network, non-media, etc.).
 */
export function useDurationFallback(file: RemoteFileDocument) {
  const [duration, setDuration] = useState<number | undefined>(file.duration)

  useEffect(() => {
    let cancelled = false
    setDuration(file.duration)

    if (!file.duration) {
      getRemoteDuration(file.url, file.contentType).then((next) => {
        if (!cancelled && next) setDuration(next)
      })
    }

    return () => {
      cancelled = true
    }
  }, [file.contentType, file.duration, file.url])

  return duration
}
