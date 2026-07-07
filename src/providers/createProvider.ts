import type {RemoteFilesProvider} from '../types'

/** @public */
export type RemoteFilesProviderConfig = Omit<RemoteFilesProvider, 'title'> & {
  title?: string
}

/**
 * Small guardrail for provider authors.
 *
 * R2/S3 use the default HTTP endpoint flow. A more custom provider can omit
 * `endpoint` only if it provides both `uploadFile` and `deleteFile` handlers.
 */
/** @public */
export function createRemoteFilesProvider(
  config: RemoteFilesProviderConfig,
  defaults: {title: string},
): RemoteFilesProvider {
  if (!config.id) throw new Error('Remote files provider needs an id.')

  if (!config.endpoint && (!config.uploadFile || !config.deleteFile)) {
    throw new Error(
      `Remote files provider "${config.id}" needs either an endpoint or both uploadFile() and deleteFile().`,
    )
  }

  return {title: defaults.title, ...config}
}
