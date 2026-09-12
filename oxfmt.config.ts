import pluginKitOxfmt from '@sanity/plugin-kit/oxfmt'
import {defineConfig} from 'oxfmt'

export default defineConfig({
  ...pluginKitOxfmt,
  ignorePatterns: [...(pluginKitOxfmt.ignorePatterns ?? []), 'CHANGELOG.md', 'templates'],
})
