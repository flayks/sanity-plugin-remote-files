import {DeleteObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import express from 'express'
import multer from 'multer'

const DEFAULT_MAX_UPLOAD_MB = 100

const app = express()
const maxBytes = (Number(process.env.MAX_UPLOAD_MB) || DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024
const upload = multer({limits: {fileSize: maxBytes, files: 1}})
const client = new S3Client({region: process.env.AWS_REGION})

app.use(async (request, response, next) => {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)
  const origin = request.headers.origin || ''
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin || '*' : allowed[0] || ''

  if (allowOrigin) response.setHeader('Access-Control-Allow-Origin', allowOrigin)
  response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, DELETE')
  // Body varies by origin, so caches must not share it
  response.setHeader('Vary', 'Origin')
  if (request.method === 'OPTIONS') return response.sendStatus(204)

  // Fail closed: these routes write and delete bucket files
  if (!(await isAuthorized(request.headers.authorization || ''))) {
    return response.status(401).json({error: 'Unauthorized'})
  }

  return next()
})

/** The shared secret, or a Sanity user allowed to create documents */
async function isAuthorized(authorization: string) {
  if (isSharedSecret(authorization)) return true
  if (!process.env.SANITY_PROJECT_ID || !authorization) return false

  // Same grants the Studio reads, viewers have no create
  const {api, project, dataset} = sanityApi()
  const url = `${api}/projects/${project}/datasets/${dataset}/acl`
  const response = await fetch(url, {headers: {authorization}})
  const grants: {permissions: string[]}[] = response.ok ? await response.json() : []
  return grants.some((grant) => grant.permissions.includes('create'))
}

function sanityApi() {
  const project = process.env.SANITY_PROJECT_ID
  const dataset = process.env.SANITY_DATASET || 'production'
  return {api: `https://${project}.api.sanity.io/v2025-01-01`, project, dataset}
}

function isSharedSecret(authorization: string) {
  const secret = process.env.REMOTE_FILES_SECRET
  return Boolean(secret) && authorization === `Bearer ${secret}`
}

/** Users must delete the document first, which checks their rights */
async function hasFileDocument(key: string, authorization: string) {
  const {api, dataset} = sanityApi()
  const query = encodeURIComponent('count(*[_type == "remoteFiles.file" && key == $key]) > 0')
  const params = `query=${query}&$key=${encodeURIComponent(JSON.stringify(key))}&perspective=published`
  const url = `${api}/data/query/${dataset}?${params}`
  const response = await fetch(url, {headers: {authorization}})
  if (!response.ok) return true

  const {result} = (await response.json()) as {result: boolean}
  return result
}

app.post('/upload', upload.single('file'), async (request, response) => {
  if (!request.file) return response.status(400).json({error: 'Missing file'})
  if (!isAllowedContentType(request.file.mimetype)) {
    return response.status(415).json({error: `Content type "${request.file.mimetype}" is not allowed`})
  }

  const bucket = required('AWS_BUCKET')
  const publicUrl = required('PUBLIC_URL').replace(/\/$/, '')
  const key = `${safePrefix(process.env.UPLOAD_PREFIX || '')}${Date.now()}-${safeName(request.file.originalname)}`

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: request.file.buffer,
    ContentType: request.file.mimetype,
  }))

  return response.json({
    key,
    url: `${publicUrl}/${key}`,
    filename: request.file.originalname,
    contentType: request.file.mimetype,
    size: request.file.size,
  })
})

app.delete('/files/:key', async (request, response) => {
  const authorization = request.headers.authorization || ''
  if (!isSharedSecret(authorization) && (await hasFileDocument(request.params.key, authorization))) {
    return response.status(409).json({error: 'Delete the file document first'})
  }

  await client.send(new DeleteObjectCommand({Bucket: required('AWS_BUCKET'), Key: request.params.key}))
  return response.json({ok: true})
})

app.listen(Number(process.env.PORT || 8787), () => {
  console.log(`Remote files S3 API listening on ${process.env.PORT || 8787}`)
})

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

/** Accepts `video/mp4` and `video/*`, empty allows all */
function isAllowedContentType(contentType: string) {
  const rules = (process.env.ALLOWED_CONTENT_TYPES || '').split(',').map((item) => item.trim()).filter(Boolean)
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
