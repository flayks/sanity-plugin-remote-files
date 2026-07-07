import {DeleteObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3'
import express from 'express'
import multer from 'multer'

const app = express()
const upload = multer()
const client = new S3Client({region: process.env.AWS_REGION})

app.use((request, response, next) => {
  const origin = request.headers.origin || '*'
  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, DELETE')
  if (request.method === 'OPTIONS') return response.sendStatus(204)
  if (process.env.REMOTE_FILES_SECRET && request.headers.authorization !== `Bearer ${process.env.REMOTE_FILES_SECRET}`) {
    return response.status(401).json({error: 'Unauthorized'})
  }
  next()
})

app.post('/upload', upload.single('file'), async (request, response) => {
  if (!request.file) return response.status(400).json({error: 'Missing file'})
  const bucket = required('AWS_BUCKET')
  const publicUrl = required('PUBLIC_URL').replace(/\/$/, '')
  const key = `${safePrefix(process.env.UPLOAD_PREFIX || 'uploads')}${Date.now()}-${safeName(request.file.originalname)}`

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: request.file.buffer,
    ContentType: request.file.mimetype,
  }))

  response.json({
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

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
}

function safePrefix(prefix: string) {
  const cleaned = prefix.trim().replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9/_-]+/g, '-')
  return cleaned ? `${cleaned}/` : ''
}
