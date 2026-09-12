export interface Env {
  BUCKET: R2Bucket
  PUBLIC_URL: string
  ALLOWED_ORIGINS: string
  REMOTE_FILES_SECRET: string
  UPLOAD_PREFIX?: string
  MAX_UPLOAD_MB?: string
  ALLOWED_CONTENT_TYPES?: string
}

const DEFAULT_MAX_UPLOAD_MB = 100

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') || ''
    const headers = corsHeaders(origin, env.ALLOWED_ORIGINS)

    if (request.method === 'OPTIONS') return new Response(null, {headers})

    // Fail closed: this endpoint writes to and deletes from your bucket
    if (!env.REMOTE_FILES_SECRET) {
      return json({error: 'REMOTE_FILES_SECRET is not configured'}, 500, headers)
    }

    if (request.headers.get('authorization') !== `Bearer ${env.REMOTE_FILES_SECRET}`) {
      return json({error: 'Unauthorized'}, 401, headers)
    }

    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/upload') {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return json({error: 'Missing file'}, 400, headers)

      const maxBytes = (Number(env.MAX_UPLOAD_MB) || DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024
      if (file.size > maxBytes) {
        return json({error: `File is larger than ${maxBytes / 1024 / 1024} MB`}, 413, headers)
      }

      if (!isAllowedContentType(file.type, env.ALLOWED_CONTENT_TYPES)) {
        return json({error: `Content type "${file.type}" is not allowed`}, 415, headers)
      }

      const prefixValue = form.has('prefix') ? form.get('prefix') : env.UPLOAD_PREFIX || ''
      const prefix = safePrefix(String(prefixValue || ''))
      const key = `${prefix}${Date.now()}-${safeName(file.name)}`
      await env.BUCKET.put(key, file.stream(), {httpMetadata: {contentType: file.type}})

      return json({
        key,
        url: `${env.PUBLIC_URL.replace(/\/$/, '')}/${key}`,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }, 200, headers)
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/files/')) {
      const key = decodeURIComponent(url.pathname.replace('/files/', ''))
      await env.BUCKET.delete(key)
      return json({ok: true}, 200, headers)
    }

    return json({error: 'Not found'}, 404, headers)
  },
}

function corsHeaders(origin: string, allowedOrigins: string) {
  const allowed = allowedOrigins.split(',').map((item) => item.trim()).filter(Boolean)
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin || '*' : allowed[0] || '*'
  return {
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, DELETE',
    'Access-Control-Allow-Origin': allowOrigin,
    // The response body varies per origin, so caches must not share it
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: HeadersInit) {
  return Response.json(body, {status, headers})
}

/** Accepts `video/mp4` and `video/*` entries. Empty config allows everything. */
function isAllowedContentType(contentType: string, allowedContentTypes?: string) {
  const rules = (allowedContentTypes || '').split(',').map((item) => item.trim()).filter(Boolean)
  if (!rules.length) return true

  return rules.some((rule) =>
    rule.endsWith('/*') ? contentType.startsWith(rule.slice(0, -1)) : contentType === rule,
  )
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
}

function safePrefix(prefix: string) {
  const cleaned = prefix.trim().replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9/_-]+/g, '-')
  return cleaned ? `${cleaned}/` : ''
}
