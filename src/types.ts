import type {ObjectInputProps, ReferenceValue} from 'sanity'

/** Field value: a reference to a `remoteFiles.file` doc */
/** @public */
export type RemoteFileValue = {
  _type?: 'remoteFile'
  asset?: ReferenceValue
}

/** File metadata doc, the file itself is in provider storage */
/** @public */
export type RemoteFileDocument = {
  _id: string
  _type: 'remoteFiles.file'
  title?: string
  description?: string
  poster?: {
    _type: 'image'
    asset?: ReferenceValue
  }
  posterUrl?: string
  filename: string
  key: string
  url: string
  provider: string
  contentType?: string
  duration?: number
  height?: number
  size?: number
  uploadedAt?: string
  width?: number
}

/**
 * Response of `POST /upload` or `uploadFile`.
 * Missing type, size and media metadata are read from the local file.
 */
/** @public */
export type UploadResult = {
  /** Storage key, used later to delete the file */
  key: string
  /** Public URL, rebuilt from `publicUrl` when set */
  url: string
  filename: string
  contentType?: string
  duration?: number
  height?: number
  size?: number
  width?: number
}

/** Upload progress callback, from 0 to 100 */
/** @public */
export type RemoteFileUploadProgress = (progress: number) => void

/** Context passed to custom upload handlers. */
/** @public */
export type RemoteFileUploadContext = {
  onProgress?: RemoteFileUploadProgress
}

/**
 * Custom client-side upload, replaces `POST <endpoint>/upload`.
 * Call `context.onProgress` to show a progress bar.
 */
/** @public */
export type RemoteFileUploadHandler = (
  file: File,
  context: RemoteFileUploadContext,
) => Promise<UploadResult>

/**
 * Custom client-side delete, replaces `DELETE <endpoint>/files/:key`.
 * Runs after the Sanity document is deleted.
 */
/** @public */
export type RemoteFileDeleteHandler = (file: RemoteFileDocument) => Promise<void>

/**
 * Storage provider. It talks to storage in one of these ways:
 * - `endpoint` with the default HTTP contract (see the README)
 * - `signedUrlProvider()`, the browser uploads to a signed URL
 * - custom `uploadFile` and `deleteFile` handlers
 *
 * This config is bundled into Studio, keep secrets in the backend.
 */
/** @public */
export type RemoteFilesProvider = {
  /** Unique id, stored on each file document */
  id: string
  /** Name in the provider select */
  title: string
  /** Base URL for `POST /upload` and `DELETE /files/:key` */
  endpoint?: string
  /** Base URL that serves files by key, replaces the returned url */
  publicUrl?: string
  /** Sent with every request, e.g. an authorization header */
  headers?: HeadersInit
  /** Extra form fields for the default upload request */
  uploadFields?: Record<string, string>
  /** Upload timeout in ms, none by default */
  timeout?: number
  uploadFile?: RemoteFileUploadHandler
  deleteFile?: RemoteFileDeleteHandler
}

/** Field-level options for a `remoteFile` schema field. */
/** @public */
export type RemoteFileFieldOptions = {
  accept?: string
  provider?: string
  /** Require a poster when the file is a video */
  requirePoster?: boolean
}

/** Plugin configuration passed to `remoteFiles()`. */
/** @public */
export type RemoteFilesPluginConfig = {
  providers: RemoteFilesProvider[]
  tool?: {
    name?: string
    title?: string
    description?: string
  }
}

/** @internal */
export type RemoteFileInputProps = ObjectInputProps<RemoteFileValue>
