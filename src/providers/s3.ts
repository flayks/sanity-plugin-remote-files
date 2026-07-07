import {createRemoteFilesProvider} from './createProvider'
import type {RemoteFilesProvider} from '../types'

/**
 * Config for the S3 provider.
 * `endpoint` is your API URL (handles upload/delete with AWS credentials).
 * `publicUrl` is the bucket URL for serving files.
 * `headers` is optional auth (e.g. `authorization: Bearer <token>`).
 */
/** @public */
export type S3ProviderConfig = Omit<
  RemoteFilesProvider,
  'title' | 'endpoint' | 'uploadFile' | 'deleteFile'
> & {
  endpoint: string
  title?: string
}

/**
 * S3-compatible provider, accessed via a small Express API.
 * The API handles `POST /upload` and `DELETE /files/:key` using the AWS SDK.
 * See `templates/s3-express/` for a ready-to-deploy API.
 */
/** @public */
export function s3Provider(config: S3ProviderConfig): RemoteFilesProvider {
  return createRemoteFilesProvider(config, {title: 'S3'})
}
