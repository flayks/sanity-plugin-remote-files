import pluginKitOxlint from '@sanity/plugin-kit/oxlint'
import {defineConfig} from 'oxlint'

export default defineConfig({
  ...pluginKitOxlint,
  // Scaffolding copied into user projects, with their own deps
  ignorePatterns: [...(pluginKitOxlint.ignorePatterns ?? []), 'templates'],
  overrides: [
    ...(pluginKitOxlint.overrides ?? []),
    {
      files: ['bin/**'],
      // A setup CLI: stdout is the interface, and the copy steps are ordered
      rules: {'no-console': 'off', 'no-await-in-loop': 'off'},
    },
  ],
})
