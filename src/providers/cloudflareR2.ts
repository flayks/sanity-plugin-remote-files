import type {RemoteFilesProvider} from '../types'
import {createRemoteFilesProvider} from './createProvider'

/** @public */
export type CloudflareR2ProviderConfig = Omit<
  RemoteFilesProvider,
  'title' | 'endpoint' | 'uploadFile' | 'deleteFile' | 'uploadFields'
> & {
  /** Worker URL, it holds the R2 binding */
  endpoint: string
  title?: string
  /** Key prefix for uploads, e.g. `videos` */
  uploadPrefix?: string
}

/**
 * Cloudflare R2 through a Worker that follows the endpoint contract.
 * Ready-to-deploy Worker in `templates/cloudflare-r2-worker`.
 */
/** @public */
export function cloudflareR2Provider(config: CloudflareR2ProviderConfig): RemoteFilesProvider {
  const {uploadPrefix, ...providerConfig} = config
  return createRemoteFilesProvider(
    {
      ...providerConfig,
      uploadFields: {prefix: uploadPrefix || ''},
    },
    {title: 'Cloudflare R2'},
  )
}
