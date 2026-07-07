import {createContext, useContext} from 'react'
import type {RemoteFilesProvider} from '../types'

/**
 * Context providing the configured providers to the field input and tool.
 * Set up by the plugin's `studio.components.layout` wrapper in `index.ts`.
 */
export const ProviderContext = createContext<RemoteFilesProvider[]>([])

/** Access all configured providers. */
export function useRemoteFilesProviders(): RemoteFilesProvider[] {
  return useContext(ProviderContext)
}

/** Find a provider by id, falling back to the first one. */
export function getProvider(
  providers: RemoteFilesProvider[],
  providerId?: string,
): RemoteFilesProvider | undefined {
  if (!providers.length) return undefined
  return providers.find((p) => p.id === providerId) || providers[0]
}
