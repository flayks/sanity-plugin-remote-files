export type FileMetadata = {
  duration?: number
  height?: number
  width?: number
}

/** True for image/* content types. */
function isImage(contentType?: string): boolean {
  return Boolean(contentType?.startsWith('image/'))
}

/** True for video/* content types. */
function isVideo(contentType?: string): boolean {
  return Boolean(contentType?.startsWith('video/'))
}

/** True for video/* or audio/* content types. */
function isMedia(contentType?: string): boolean {
  return Boolean(isVideo(contentType) || contentType?.startsWith('audio/'))
}

/**
 * Internal helper: probe image/video/audio intrinsic metadata.
 * Works with both object URLs (local File) and remote URLs (existing files).
 */
function probeMetadata(src: string, contentType?: string): Promise<FileMetadata> {
  return new Promise((resolve) => {
    if (isImage(contentType)) {
      const image = new Image()
      image.addEventListener('load', () =>
        resolve({
          height: image.naturalHeight || undefined,
          width: image.naturalWidth || undefined,
        }),
      )
      image.addEventListener('error', () => resolve({}))
      image.src = src
      return
    }

    if (!isMedia(contentType)) {
      resolve({})
      return
    }

    const el = contentType!.startsWith('audio/')
      ? document.createElement('audio')
      : document.createElement('video')
    el.preload = 'metadata'
    el.addEventListener('loadedmetadata', () => {
      const metadata: FileMetadata = {}
      if (Number.isFinite(el.duration)) metadata.duration = el.duration
      if (el instanceof HTMLVideoElement) {
        metadata.height = el.videoHeight || undefined
        metadata.width = el.videoWidth || undefined
      }
      resolve(metadata)
    })
    el.addEventListener('error', () => resolve({}))
    el.src = src
  })
}

/**
 * Extract metadata from a local File before upload.
 * Creates a temporary object URL, probes it, then revokes.
 */
export async function getFileMetadata(file: File): Promise<FileMetadata> {
  if (!isImage(file.type) && !isMedia(file.type)) return {}
  const url = URL.createObjectURL(file)
  try {
    return await probeMetadata(url, file.type)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Fetch metadata from a remote URL for existing files that don't have stored
 * metadata yet. Best-effort — returns an empty object on failure.
 */
export function getRemoteMetadata(url: string, contentType?: string): Promise<FileMetadata> {
  return probeMetadata(url, contentType)
}
