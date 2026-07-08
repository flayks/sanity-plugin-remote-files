/** Human-readable byte size, e.g. `6.1 MB`. */
export function formatBytes(value?: number): string {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** index
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`
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
