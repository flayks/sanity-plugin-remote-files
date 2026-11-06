export interface Env {
  BUCKET: R2Bucket
  PUBLIC_URL: string
  ALLOWED_ORIGINS: string
  SANITY_PROJECT_ID?: string
  SANITY_DATASET?: string
  REMOTE_FILES_SECRET?: string
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

    // Fail closed: this endpoint writes and deletes bucket files
    const authorization = request.headers.get('authorization') || ''
    if (!(await isAuthorized(authorization, env))) {
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
      if (!isSharedSecret(authorization, env) && (await hasFileDocument(key, authorization, env))) {
        return json({error: 'Delete the file document first'}, 409, headers)
      }

      await env.BUCKET.delete(key)
      return json({ok: true}, 200, headers)
    }

    return json({error: 'Not found'}, 404, headers)
  },
}

/** The shared secret, or a Sanity user allowed to create documents */
async function isAuthorized(authorization: string, env: Env) {
  if (isSharedSecret(authorization, env)) return true
  if (!env.SANITY_PROJECT_ID || !authorization) return false

  // Same grants the Studio reads, viewers have no create
  const {api, project, dataset} = sanityApi(env)
  const url = `${api}/projects/${project}/datasets/${dataset}/acl`
  const response = await fetch(url, {headers: {authorization}})
  const grants: {permissions: string[]}[] = response.ok ? await response.json() : []
  return grants.some((grant) => grant.permissions.includes('create'))
}

function sanityApi(env: Env) {
  const project = env.SANITY_PROJECT_ID
  const dataset = env.SANITY_DATASET || 'production'
  return {api: `https://${project}.api.sanity.io/v2025-01-01`, project, dataset}
}

function isSharedSecret(authorization: string, env: Env) {
  return Boolean(env.REMOTE_FILES_SECRET) && authorization === `Bearer ${env.REMOTE_FILES_SECRET}`
}

/** Users must delete the document first, which checks their rights */
async function hasFileDocument(key: string, authorization: string, env: Env) {
  const {api, dataset} = sanityApi(env)
  const query = encodeURIComponent('count(*[_type == "remoteFiles.file" && key == $key]) > 0')
  const params = `query=${query}&$key=${encodeURIComponent(JSON.stringify(key))}&perspective=published`
  const url = `${api}/data/query/${dataset}?${params}`
  const response = await fetch(url, {headers: {authorization}})
  if (!response.ok) return true

  const {result}: {result: boolean} = await response.json()
  return result
}

function corsHeaders(origin: string, allowedOrigins: string) {
  const allowed = allowedOrigins.split(',').map((item) => item.trim()).filter(Boolean)
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin || '*' : allowed[0] || '*'
  return {
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST, DELETE',
    'Access-Control-Allow-Origin': allowOrigin,
    // Body varies by origin, so caches must not share it
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: HeadersInit) {
  return Response.json(body, {status, headers})
}

/** Accepts `video/mp4` and `video/*`, empty allows all */
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
