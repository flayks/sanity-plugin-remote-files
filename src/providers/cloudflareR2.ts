import {createRemoteFilesProvider} from './createProvider'
import type {RemoteFilesProvider} from '../types'

/**
 * Config for the Cloudflare R2 provider.
 * `endpoint` is your Worker URL (handles upload/delete with R2 credentials).
 * `publicUrl` is the R2 public bucket URL for serving files.
 * `headers` is optional auth (e.g. `authorization: Bearer <token>`).
 */
/** @public */
export type CloudflareR2ProviderConfig = Omit<
  RemoteFilesProvider,
  'title' | 'endpoint' | 'uploadFile' | 'deleteFile' | 'uploadFields'
> & {
  endpoint: string
  title?: string
  uploadPrefix?: string
}

/**
 * Cloudflare R2 provider, accessed via a Cloudflare Worker proxy.
 * The Worker handles `POST /upload` and `DELETE /files/:key` using R2 bindings.
 * See `templates/cloudflare-r2-worker/` for a ready-to-deploy Worker.
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
