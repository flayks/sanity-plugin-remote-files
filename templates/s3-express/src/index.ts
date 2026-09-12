import {DeleteObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import express from 'express'
import multer from 'multer'

const DEFAULT_MAX_UPLOAD_MB = 100

const app = express()
const maxBytes = (Number(process.env.MAX_UPLOAD_MB) || DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024
const upload = multer({limits: {fileSize: maxBytes, files: 1}})
const client = new S3Client({region: process.env.AWS_REGION})

app.use((request, response, next) => {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)
  const origin = request.headers.origin || ''
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin || '*' : allowed[0] || ''

  if (allowOrigin) response.setHeader('Access-Control-Allow-Origin', allowOrigin)
  response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, DELETE')
  // The response body varies per origin, so caches must not share it
  response.setHeader('Vary', 'Origin')
  if (request.method === 'OPTIONS') return response.sendStatus(204)

  // Fail closed: these routes write to and delete from your bucket
  if (!process.env.REMOTE_FILES_SECRET) {
    return response.status(500).json({error: 'REMOTE_FILES_SECRET is not configured'})
  }
  if (request.headers.authorization !== `Bearer ${process.env.REMOTE_FILES_SECRET}`) {
    return response.status(401).json({error: 'Unauthorized'})
  }

  return next()
})

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
  await client.send(new DeleteObjectCommand({Bucket: required('AWS_BUCKET'), Key: request.params.key}))
  response.json({ok: true})
})

app.listen(Number(process.env.PORT || 8787), () => {
  console.log(`Remote files S3 API listening on ${process.env.PORT || 8787}`)
})

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

/** Accepts `video/mp4` and `video/*` entries. Empty config allows everything. */
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
