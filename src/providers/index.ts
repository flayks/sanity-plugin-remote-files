/**
 * Storage providers, one factory per file.
 * To add one, follow `cloudflareR2.ts`, then export it here and from `../index.ts`.
 *
 * Default endpoint contract, also in the README:
 *   POST   /upload      multipart/form-data with a `file` field, returns `UploadResult`
 *   DELETE /files/:key  removes the stored file
 *
 * Signed URL and custom providers use `uploadFile` and `deleteFile` instead.
 */
export {createRemoteFilesProvider} from './createProvider'
export type {RemoteFilesProviderConfig} from './createProvider'
export {cloudflareR2Provider} from './cloudflareR2'
export type {CloudflareR2ProviderConfig} from './cloudflareR2'
export {signedUrlProvider} from './signedUrl'
export type {SignedUploadUrlResult, SignedUrlProviderConfig} from './signedUrl'
export {s3Provider} from './s3'
export type {S3ProviderConfig} from './s3'
