import type {RemoteFilesProvider} from '../types'
import {createRemoteFilesProvider} from './createProvider'

/** @public */
export type S3ProviderConfig = Omit<
  RemoteFilesProvider,
  'title' | 'endpoint' | 'uploadFile' | 'deleteFile'
> & {
  /** API URL, it holds the AWS credentials */
  endpoint: string
  title?: string
}

/**
 * S3-compatible storage through an API that follows the endpoint contract.
 * Ready-to-deploy Express API in `templates/s3-express`.
 */
/** @public */
export function s3Provider(config: S3ProviderConfig): RemoteFilesProvider {
  return createRemoteFilesProvider(config, {title: 'S3'})
}
