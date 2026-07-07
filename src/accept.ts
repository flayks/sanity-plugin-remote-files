/**
 * Matches browser `accept` syntax against a file/content type.
 * Supports MIME types (`video/mp4`), wildcards (`video/*`) and extensions (`.mp4`).
 */
export function matchesAccept(
  accept: string | undefined,
  file: {contentType?: string; filename?: string; name?: string; type?: string},
): boolean {
  if (!accept?.trim()) return true

  const contentType = (file.contentType || file.type || '').toLowerCase()
  const filename = (file.filename || file.name || '').toLowerCase()

  return accept.split(',').some((item) => {
    const rule = item.trim().toLowerCase()
    if (!rule || rule === '*/*') return true
    if (rule.startsWith('.')) return filename.endsWith(rule)
    if (rule.endsWith('/*')) return contentType.startsWith(`${rule.slice(0, -1)}`)
    return contentType === rule
  })
}
