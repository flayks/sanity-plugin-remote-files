function parseAccept(accept?: string): string[] {
  return (accept || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

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

  return parseAccept(accept).some((rule) => {
    if (rule === '*/*') return true
    if (rule.startsWith('.')) return filename.endsWith(rule)
    if (rule.endsWith('/*')) return contentType.startsWith(rule.slice(0, -1))
    return contentType === rule
  })
}

/**
 * Same rules as a GROQ condition, so the query returns matching files
 * instead of filtering a capped result set in the browser.
 * Returns null for rule sets GROQ can't express, such as extensions.
 */
export function acceptToGroq(accept?: string): string | null {
  const rules = parseAccept(accept)
  if (!rules.length || rules.some((rule) => rule === '*/*' || rule.startsWith('.'))) return null

  const conditions = rules.map((rule) =>
    rule.endsWith('/*')
      ? `string::startsWith(contentType, ${JSON.stringify(rule.slice(0, -1))})`
      : `contentType == ${JSON.stringify(rule)}`,
  )

  return `(${conditions.join(' || ')})`
}

/** Shared toast for a file the field's `accept` rules reject. */
export function acceptErrorToast(accept?: string) {
  return {
    status: 'error' as const,
    title: 'File type not allowed',
    description: `This field accepts: ${accept}`,
  }
}
