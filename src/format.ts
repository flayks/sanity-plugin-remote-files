import {DocumentIcon} from '@sanity/icons/Document'
import {ImageIcon} from '@sanity/icons/Image'
import {PlayIcon} from '@sanity/icons/Play'
import {VideoIcon} from '@sanity/icons/Video'

/** Byte size, e.g. `6.12 MB` or `645.3 KB` */
export function formatBytes(value?: number): string {
  if (!Number.isFinite(value) || !value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** index
  const decimals = index === 0 ? 0 : index === 1 ? 1 : 2

  return `${amount.toFixed(decimals)} ${units[index]}`
}

/** Locale date and time, e.g. `Jul 6, 2026, 2:30 PM` */
export function formatDate(value?: string): string {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'}).format(
    new Date(value),
  )
}

/** `M:SS` or `H:MM:SS`, undefined so callers skip it */
export function formatDuration(value?: number): string | undefined {
  if (!Number.isFinite(value) || !value) return undefined
  const totalSeconds = Math.round(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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

/** Metadata parts for cards and one-line summaries */
export function formatFileInfoParts(file: FileInfoValue) {
  return {
    contentType: file.contentType || 'Remote file',
    dimensions: file.width && file.height ? `${file.width} x ${file.height}` : undefined,
    duration: formatDuration(file.duration),
    size: file.size ? formatBytes(file.size) : undefined,
    uploadedAt: file.uploadedAt ? formatDate(file.uploadedAt) : undefined,
  }
}

/** Metadata line, e.g. `video/mp4 · 0:07 · 6.1 MB` */
export function formatFileInfo(file: FileInfoValue): string {
  const info = formatFileInfoParts(file)

  return [info.contentType, info.duration, info.dimensions, info.size, info.uploadedAt]
    .filter(Boolean)
    .join(' · ')
}

/** File kind icon for document previews */
export function getFileIcon(contentType?: string) {
  if (isPreviewableImage(contentType)) return ImageIcon
  if (isPreviewableVideo(contentType)) return VideoIcon
  if (isPreviewableAudio(contentType)) return PlayIcon
  return DocumentIcon
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
