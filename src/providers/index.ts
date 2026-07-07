/**
 * Storage providers.
 *
 * Each provider lives in its own file and exports a factory function.
 * To add a new provider, create a file here following `cloudflareR2.ts`,
 * then export it below and from `../index.ts`.
 *
 * R2 and the S3 template both use the default HTTP endpoint contract:
 *   POST /upload      — multipart/form-data with a `file` field
 *                       returns `{ key, url, filename, contentType?, size? }`
 *   DELETE /files/:key — removes the file from storage
 *
 * Signed URL providers and custom providers can provide `uploadFile` and
 * `deleteFile` instead. Workers are only required by the bundled R2 template.
 */
export {createRemoteFilesProvider} from './createProvider'
export type {RemoteFilesProviderConfig} from './createProvider'
export {cloudflareR2Provider} from './cloudflareR2'
export type {CloudflareR2ProviderConfig} from './cloudflareR2'
export {signedUrlProvider} from './signedUrl'
export type {SignedUploadUrlResult, SignedUrlProviderConfig} from './signedUrl'
export {s3Provider} from './s3'
export type {S3ProviderConfig} from './s3'
