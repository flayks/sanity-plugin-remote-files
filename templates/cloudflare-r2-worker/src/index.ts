export interface Env {
  BUCKET: R2Bucket
  PUBLIC_URL: string
  ALLOWED_ORIGINS: string
  UPLOAD_PREFIX?: string
  REMOTE_FILES_SECRET?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') || ''
    const headers = corsHeaders(origin, env.ALLOWED_ORIGINS)

    if (request.method === 'OPTIONS') return new Response(null, {headers})

    if (env.REMOTE_FILES_SECRET) {
      const expected = `Bearer ${env.REMOTE_FILES_SECRET}`
      if (request.headers.get('authorization') !== expected) {
        return json({error: 'Unauthorized'}, 401, headers)
      }
    }

    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/upload') {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return json({error: 'Missing file'}, 400, headers)

      const prefix = safePrefix(String(form.get('prefix') || env.UPLOAD_PREFIX || 'uploads'))
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
  }
}

function json(body: unknown, status: number, headers: HeadersInit) {
  return Response.json(body, {status, headers})
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
}

function safePrefix(prefix: string) {
  const cleaned = prefix.trim().replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9/_-]+/g, '-')
  return cleaned ? `${cleaned}/` : ''
}
