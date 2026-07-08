import {defineField, defineType} from 'sanity'
import {RemoteFileInput} from './components/RemoteFileInput'

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
