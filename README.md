<h2 align="center">
  Remote Files Plugin for Sanity
</h2>
<p align="center">
  Upload, browse and reference files stored outside of Sanity Studio.<br/>
  Useful for large videos, audio files, archives, PDFs or any file you want to keep in R2, S3 or another storage backend.
</p>

<img width="1920" height="1080" alt="plugin screenshot" src="https://github.com/user-attachments/assets/9571de44-9a96-451a-964c-6f78bd6354b7" />

## Features

- **Remote files tool**: Browse, search, upload and manage your remote file library.
- **`remoteFile` field type**: Upload or select remote files directly from document fields.
- **File details dialog**: Preview files, edit internal titles, inspect metadata and see which documents use a file.
- **Cloudflare R2 provider**: Worker-backed upload/delete flow with an interactive setup command.
- **S3-compatible provider**: Express API template for S3 or S3-compatible storage.
- **Flexible providers**: Use the bundled R2/S3 providers or add your own.
- **Backend-only secrets**: Provider credentials stay in your Worker/API, not in Sanity documents.

## Installation

```sh
# npm
npm i sanity-plugin-remote-files

# yarn
yarn add sanity-plugin-remote-files

# pnpm
pnpm add sanity-plugin-remote-files

# bun
bun add sanity-plugin-remote-files
```

## Usage

Add it as a plugin in `sanity.config.ts` (or `.js`):

```ts
import { defineConfig } from 'sanity'
import { cloudflareR2Provider, remoteFiles } from 'sanity-plugin-remote-files'

export default defineConfig({
  // ...
  plugins: [
    remoteFiles({
      tool: {
        title: 'Videos',
        description: 'Browser, upload and manage videos.',
      },
      providers: [
        cloudflareR2Provider({
          id: 'r2',
          endpoint: process.env.SANITY_STUDIO_R2_ENDPOINT,
          publicUrl: process.env.SANITY_STUDIO_R2_PUBLIC_URL,
          uploadPrefix: 'uploads',
          headers: {
            authorization: `Bearer ${process.env.SANITY_STUDIO_R2_TOKEN}`,
          },
        }),
      ],
    }),
  ],
})
```

Then use the `remoteFile` field type in your schema:

```ts
import { defineField, defineType } from 'sanity'

export const page = defineType({
  name: 'page',
  type: 'document',
  fields: [
    defineField({
      name: 'video',
      title: 'Video',
      type: 'remoteFile',
      options: {
        accept: 'video/*',
        provider: 'r2',
      },
    }),
  ],
})
```

## Setup Cloudflare R2

Run the interactive R2 setup after installing the plugin:

```sh
npx sanity-plugin-remote-files setup r2 remote-files-r2-worker
```

The setup will:

- Create or reuse an R2 bucket
- Generate and deploy the Worker used by the plugin
- Configure the public file URL and allowed Studio origins
- Print the Sanity config snippet to add to your Studio

If you only want the Worker files without running Cloudflare setup:

```sh
npx sanity-plugin-remote-files setup r2 remote-files-r2-worker --template-only
```

## Setup S3

S3 setup scaffolds a small Express API template. Bucket, IAM and deployment differ between AWS setups, so those stay explicit.

```sh
npx sanity-plugin-remote-files setup s3 remote-files-s3-api
```

## Options

### `remoteFiles(config)`

Main plugin function. Adds the `remoteFiles.file` document type, the `remoteFile` field type and the Studio tool.

- `providers: RemoteFilesProvider[]` - configured storage providers
- `tool.name?: string` - tool route name. Default: `'remote-files'`
- `tool.title?: string` - tool title. Default: `'Remote files'`
- `tool.description?: string` - text shown at the top of the tool

### `remoteFile` field options

- `accept?: string` - value passed to the native file input, for example `'video/*'` or `'.pdf'`.
- `provider?: string` - provider id to use for this field. If omitted, the first provider is used.

Provider ids are stored on file documents and make multiple instances possible:

```ts
remoteFiles({
  providers: [
    cloudflareR2Provider({ id: 'marketing-r2', endpoint: process.env.SANITY_STUDIO_MARKETING_R2_ENDPOINT }),
    cloudflareR2Provider({ id: 'product-r2', endpoint: process.env.SANITY_STUDIO_PRODUCT_R2_ENDPOINT }),
  ],
})
```

## Adding Providers

Providers are not tied to Cloudflare Workers. The bundled R2 setup uses a Worker because it is a good fit for R2, but other providers can use any backend, SDK, signed URL flow or REST API.

Cloudflare R2 and the S3 template both use the same basic idea: the Studio talks to your Worker/API and that backend talks to storage with the real credentials.

The default backend contract is intentionally small:

```txt
POST   /upload      multipart/form-data with a `file` field
DELETE /files/:key  delete a stored object
```

`POST /upload` returns the file metadata the plugin stores in Sanity:

```ts
{
  key: string
  url: string
  filename: string
  contentType?: string
  size?: number
}
```

If another storage provider can follow that contract, adding it is usually just a small provider factory:

```ts
import { createRemoteFilesProvider } from 'sanity-plugin-remote-files'

export function myProvider(config: {id: string; endpoint: string; title?: string}) {
  return createRemoteFilesProvider(config, {title: 'My Provider'})
}
```

For signed URL flows, use `signedUrlProvider` with a backend endpoint that creates signed upload URLs and a delete endpoint. For anything else, providers can define custom `uploadFile` and `deleteFile` handlers. Keep secrets out of Studio code; prefer calling your own backend for privileged operations.

## Querying

Files are stored as `remoteFiles.file` documents. A `remoteFile` field stores a reference to one of those documents.

```groq
*[_type == 'page']{
  title,
  video{
    asset->{
      _id,
      title,
      filename,
      url,
      key,
      provider,
      contentType,
      duration,
      size,
      uploadedAt
    }
  }
}
```

For a cleaner frontend projection:

```groq
*[_type == 'page']{
  title,
  "video": video.asset->{
    "title": coalesce(title, filename),
    filename,
    url,
    contentType,
    duration,
    size
  }
}
```

## License

[MIT](LICENSE) © Félix Péault (Flayks)

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.
