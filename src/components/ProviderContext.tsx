import {createContext, useContext} from 'react'
import type {LayoutProps} from 'sanity'

import type {RemoteFilesProvider} from '../types'

/** Providers for the input and tool, set by the layout */
export const ProviderContext = createContext<RemoteFilesProvider[]>([])

/** Studio layout that provides the configured providers */
export function createProviderLayout(providers: RemoteFilesProvider[]) {
  return function ProviderLayout(props: LayoutProps) {
    return (
      <ProviderContext.Provider value={providers}>
        {props.renderDefault(props)}
      </ProviderContext.Provider>
    )
  }
}

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
