/** Human-readable byte size, e.g. `6.12mb` or `645.3kb`. */
export function formatBytes(value?: number): string {
  if (!value) return '0b'
  const units = ['b', 'kb', 'mb', 'gb', 'tb']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** index
  const decimals = index === 0 ? 0 : index === 1 ? 1 : 2

  return `${amount.toFixed(decimals)}${units[index]}`
}

/** Short locale date and time, e.g. `Jul 6, 2026, 2:30 PM`. */
export function formatDate(value?: string): string {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value))
}

/**
 * Duration in `M:SS` or `H:MM:SS` format.
 * Returns undefined for falsy/non-finite values so callers can skip rendering.
 */
export function formatDuration(value?: number): string | undefined {
  if (!Number.isFinite(value) || !value) return undefined
  const totalSeconds = Math.round(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

type FileInfoValue = {
  contentType?: string
  duration?: number
  height?: number
  size?: number
  uploadedAt?: string
  width?: number
}

/** Formatted file metadata parts used by cards and one-line summaries. */
export function formatFileInfoParts(file: FileInfoValue) {
  return {
    contentType: file.contentType || 'Remote file',
    dimensions: file.width && file.height ? `${file.width} x ${file.height}` : undefined,
    duration: formatDuration(file.duration),
    size: formatBytes(file.size),
    uploadedAt: formatDate(file.uploadedAt),
  }
}

/** One-line file metadata, e.g. `video/mp4 · 0:07 · 1920 x 1080 · 6.1 MB · Jul 6, 2026, 9:37 PM`. */
export function formatFileInfo(file: FileInfoValue): string {
  const info = formatFileInfoParts(file)

  return [info.contentType, info.duration, info.dimensions, info.size, info.uploadedAt]
    .filter(Boolean)
    .join(' · ')
}

/** True if the content type is a previewable image. */
export function isPreviewableImage(contentType?: string): boolean {
  return Boolean(contentType?.startsWith('image/'))
}

/** True if the content type is a previewable video. */
export function isPreviewableVideo(contentType?: string): boolean {
  return Boolean(contentType?.startsWith('video/'))
}

/** True if the content type is previewable audio. */
export function isPreviewableAudio(contentType?: string): boolean {
  return Boolean(contentType?.startsWith('audio/'))
}
