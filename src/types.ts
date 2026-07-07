import type {ObjectInputProps, ReferenceValue} from 'sanity'

/**
 * Value stored on a `remoteFile` field in a document.
 * It's a thin reference to a `remoteFiles.file` document.
 */
/** @public */
export type RemoteFileValue = {
  _type?: 'remoteFile'
  asset?: ReferenceValue
}

/**
 * A `remoteFiles.file` document — metadata only.
 * The actual file lives in the provider's storage (R2, S3, etc.).
 */
/** @public */
export type RemoteFileDocument = {
  _id: string
  _type: 'remoteFiles.file'
  title?: string
  description?: string
  filename: string
  key: string
  url: string
  provider: string
  contentType?: string
  duration?: number
  size?: number
  uploadedAt?: string
}

/** Response from the provider's `POST /upload` endpoint. */
/** @public */
export type UploadResult = {
  key: string
  url: string
  filename: string
  contentType?: string
  size?: number
}

/** Upload progress callback, used by providers that can report browser upload progress. */
/** @public */
export type RemoteFileUploadProgress = (progress: number) => void

/** Context passed to custom upload handlers. */
/** @public */
export type RemoteFileUploadContext = {
  onProgress?: RemoteFileUploadProgress
}

/** Upload implementation for providers that need custom client-side logic. */
/** @public */
export type RemoteFileUploadHandler = (
  file: File,
  context: RemoteFileUploadContext,
) => Promise<UploadResult>

/** Delete implementation for providers that need custom client-side logic. */
/** @public */
export type RemoteFileDeleteHandler = (file: RemoteFileDocument) => Promise<void>

/**
 * A storage provider.
 *
 * Providers can use the default HTTP contract (`endpoint`), a signed URL
 * helper, or fully custom `uploadFile`/`deleteFile` handlers.
 *
 * Keep secrets in the backend. Anything in this config is bundled into Studio.
 */
/** @public */
export type RemoteFilesProvider = {
  id: string
  title: string
  endpoint?: string
  publicUrl?: string
  headers?: HeadersInit
  /** Extra form fields sent with the default HTTP upload request. */
  uploadFields?: Record<string, string>
  uploadFile?: RemoteFileUploadHandler
  deleteFile?: RemoteFileDeleteHandler
}

/** Field-level options for a `remoteFile` schema field. */
/** @public */
export type RemoteFileFieldOptions = {
  accept?: string
  provider?: string
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
