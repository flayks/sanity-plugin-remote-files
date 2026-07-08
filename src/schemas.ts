import {defineField, defineType} from 'sanity'
import {RemoteFileInput} from './components/RemoteFileInput'
import type {RemoteFileFieldOptions, RemoteFileValue} from './types'

function isVideoDocument(document: unknown) {
  if (!document || typeof document !== 'object' || !('contentType' in document)) return false

  return String(document.contentType || '').startsWith('video/')
}

/**
 * Document type for each uploaded remote file.
 * Stores metadata only — the actual file lives in the provider's storage.
 * Referenced by `remoteFile` fields via a standard Sanity reference.
 */
export const remoteFileDocument = defineType({
  name: 'remoteFiles.file',
  title: 'Remote file',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({name: 'description', title: 'Description', type: 'text'}),
    defineField({
      name: 'poster',
      title: 'Poster',
      type: 'image',
      description: "A lightweight preview image, usually the video's first frame, shown before playback starts.",
      hidden: ({document}) => !isVideoDocument(document),
    }),
    defineField({
      name: 'filename',
      title: 'Filename',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'key',
      title: 'Storage key',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'provider',
      title: 'Provider',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'contentType', title: 'Content type', type: 'string'}),
    defineField({
      name: 'duration',
      title: 'Duration',
      type: 'number',
      description: 'Duration in seconds, for video and audio files.',
    }),
    defineField({
      name: 'width',
      title: 'Width',
      type: 'number',
      description: 'Intrinsic width in pixels, for image and video files.',
    }),
    defineField({
      name: 'height',
      title: 'Height',
      type: 'number',
      description: 'Intrinsic height in pixels, for image and video files.',
    }),
    defineField({name: 'size', title: 'Size', type: 'number'}),
    defineField({name: 'uploadedAt', title: 'Uploaded at', type: 'datetime'}),
  ],
  preview: {
    select: {title: 'title', filename: 'filename', subtitle: 'contentType'},
    prepare(selection) {
      return {
        title: selection.title || selection.filename || 'Untitled file',
        subtitle: selection.subtitle,
      }
    },
  },
})

/**
 * Object field type used in document schemas. Renders a custom input
 * that lets editors upload or pick a remote file, storing a reference
 * to the corresponding `remoteFiles.file` document.
 */
export const remoteFileType = defineType({
  name: 'remoteFile',
  title: 'Remote file',
  type: 'object',
  components: {input: RemoteFileInput},
  fields: [
    defineField({
      name: 'asset',
      title: 'Asset',
      type: 'reference',
      to: [{type: 'remoteFiles.file'}],
    }),
  ],
  validation: (rule) =>
    rule.custom(async (value, context) => {
      const options = (context.type?.options || {}) as RemoteFileFieldOptions
      if (!options.requirePoster) return true

      const ref = (value as RemoteFileValue | undefined)?.asset?._ref
      if (!ref) return true

      const file = await context.getClient({apiVersion: '2025-01-01'}).fetch<{
        contentType?: string
        hasPoster?: boolean
      } | null>(
        '*[_id == $id][0]{contentType, "hasPoster": defined(poster.asset._ref)}',
        {id: ref},
      )

      return !isVideoDocument(file) || file?.hasPoster ? true : 'A poster image is required for this video'
    }),
  preview: {
    select: {title: 'asset.title', filename: 'asset.filename', subtitle: 'asset.contentType'},
    prepare(selection) {
      return {
        title: selection.title || selection.filename || 'Remote file',
        subtitle: selection.subtitle,
      }
    },
  },
})
