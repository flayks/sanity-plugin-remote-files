function parseAccept(accept?: string): string[] {
  return (accept || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

/** Matches accept rules: `video/mp4`, `video/*` or `.mp4` */
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

/** accept as GROQ before the cap, null for extensions */
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

/** Toast for a file the `accept` rules reject */
export function acceptErrorToast(accept?: string) {
  return {
    status: 'error' as const,
    title: 'File type not allowed',
    description: `This field accepts: ${accept}`,
  }
}
