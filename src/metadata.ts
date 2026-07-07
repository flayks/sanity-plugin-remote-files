export type FileMetadata = {
  duration?: number
}

/** True for video/* or audio/* content types. */
function isMedia(contentType?: string): boolean {
  return Boolean(contentType?.startsWith('video/') || contentType?.startsWith('audio/'))
}

/**
 * Internal helper: probe a media element for its `duration` property.
 * Works with both object URLs (local File) and remote URLs (existing files).
 */
function probeDuration(src: string, contentType?: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (!isMedia(contentType)) {
      resolve(undefined)
      return
    }
    const el = contentType!.startsWith('audio/')
      ? document.createElement('audio')
      : document.createElement('video')
    el.preload = 'metadata'
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : undefined)
    el.onerror = () => resolve(undefined)
    el.src = src
  })
}

/**
 * Extract metadata from a local File before upload.
 * Creates a temporary object URL, probes it, then revokes.
 */
export async function getFileMetadata(file: File): Promise<FileMetadata> {
  if (!isMedia(file.type)) return {}
  const url = URL.createObjectURL(file)
  try {
    return {duration: await probeDuration(url, file.type)}
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Fetch duration from a remote URL for existing files that don't have
 * a stored `duration` value yet. Best-effort — returns undefined on failure.
 */
export function getRemoteDuration(
  url: string,
  contentType?: string,
): Promise<number | undefined> {
  return probeDuration(url, contentType)
}
