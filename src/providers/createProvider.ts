import type {RemoteFilesProvider} from '../types'

/** @public */
export type RemoteFilesProviderConfig = Omit<RemoteFilesProvider, 'title'> & {
  title?: string
}

/**
 * Base for provider factories: checks the config and sets a default title.
 * Needs `endpoint`, or both `uploadFile` and `deleteFile`.
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

  return {...config, title: config.title || defaults.title}
}
