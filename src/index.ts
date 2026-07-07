import {FolderIcon} from '@sanity/icons/Folder'
import {createElement} from 'react'
import {definePlugin} from 'sanity'
import {ProviderContext} from './components/ProviderContext'
import {RemoteFilesTool} from './components/RemoteFilesTool'
import {cloudflareR2Provider, createRemoteFilesProvider, s3Provider, signedUrlProvider} from './providers/index'
import {remoteFileDocument, remoteFileType} from './schemas'
import type {RemoteFilesPluginConfig} from './types'

export type {
  RemoteFileDocument,
  RemoteFileDeleteHandler,
  RemoteFileFieldOptions,
  RemoteFileInputProps,
  RemoteFileUploadHandler,
  RemoteFilesPluginConfig,
  RemoteFilesProvider,
  RemoteFileValue,
  UploadResult,
} from './types'

export {cloudflareR2Provider, createRemoteFilesProvider, s3Provider, signedUrlProvider}
export type {CloudflareR2ProviderConfig, RemoteFilesProviderConfig, S3ProviderConfig} from './providers/index'
export type {SignedUploadUrlResult, SignedUrlProviderConfig} from './providers/index'

/**
 * Remote files plugin for Sanity Studio.
 *
 * Files live in your storage provider (Cloudflare R2, S3, etc.);
 * Sanity stores lightweight metadata documents and field references.
 *
 * @example
 * ```ts
 * import {remoteFiles, cloudflareR2Provider} from 'sanity-plugin-remote-files'
 *
 * remoteFiles({
 *   providers: [
 *     cloudflareR2Provider({
 *       id: 'r2',
 *       endpoint: process.env.SANITY_STUDIO_R2_ENDPOINT!,
 *       publicUrl: process.env.SANITY_STUDIO_R2_PUBLIC_URL,
 *       headers: {authorization: `Bearer ${process.env.SANITY_STUDIO_R2_TOKEN}`},
 *     }),
 *   ],
 *   tool: {title: 'Videos', description: 'Remote video library.'},
 * })
 * ```
 */
/** @public */
export const remoteFiles = definePlugin<RemoteFilesPluginConfig>((config) => {
  const providers = config.providers || []
  const toolName = config.tool?.name || 'remote-files'
  const toolTitle = config.tool?.title || 'Remote files'
  const toolDescription =
    config.tool?.description ||
    'Upload, browse and manage files stored outside of Sanity.'

  return {
    name: 'sanity-plugin-remote-files',
    schema: {
      types: [remoteFileDocument, remoteFileType],
    },
    // Wrap the Studio layout with a context provider so the field input
    // and tool can access the configured providers without prop drilling.
    studio: {
      components: {
        layout: (props) =>
          createElement(ProviderContext.Provider, {value: providers}, props.renderDefault(props)),
      },
    },
    tools: [
      {
        name: toolName,
        title: toolTitle,
        icon: FolderIcon,
        component: () =>
          createElement(RemoteFilesTool, {
            description: toolDescription,
            providers,
            title: toolTitle,
          }),
      },
    ],
  }
})
