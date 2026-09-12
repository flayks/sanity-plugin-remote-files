import {DocumentIcon} from '@sanity/icons/Document'
import {PlayIcon} from '@sanity/icons/Play'
import {Card, Flex, Text} from '@sanity/ui'

import {isPreviewableAudio, isPreviewableImage, isPreviewableVideo} from '../format'
import type {RemoteFileDocument} from '../types'

type FilePreviewProps = {
  file: RemoteFileDocument
  height?: number
  controls?: boolean
  fit?: 'cover' | 'contain'
}

/** Renders an inline preview for the file: image, video, or a fallback icon. */
export function FilePreview({controls, file, fit = 'cover', height = 160}: FilePreviewProps) {
  const background = fit === 'contain' ? '#f1f3f6' : undefined

  if (isPreviewableImage(file.contentType)) {
    return (
      <img
        alt={file.title || file.filename}
        src={file.url}
        style={{background, display: 'block', height, objectFit: fit, width: '100%'}}
      />
    )
  }

  if (isPreviewableVideo(file.contentType)) {
    if (file.posterUrl && !controls) {
      return (
        <img
          alt={file.title || file.filename}
          src={file.posterUrl}
          style={{background, display: 'block', height, objectFit: fit, width: '100%'}}
        />
      )
    }

    return (
      // oxlint-disable-next-line jsx-a11y/media-has-caption -- no caption track for remote files
      <video
        controls={controls}
        muted={!controls}
        poster={file.posterUrl}
        playsInline
        preload={controls ? 'auto' : 'metadata'}
        src={file.url}
        style={{
          background: controls ? '#000' : background,
          display: 'block',
          height,
          objectFit: controls ? 'contain' : fit,
          width: '100%',
        }}
      />
    )
  }

  if (isPreviewableAudio(file.contentType)) {
    return (
      <Card tone="transparent" padding={4} style={{height}}>
        <Flex align="center" height="fill" justify="center" direction="column" gap={4}>
          {controls ? (
            // oxlint-disable-next-line jsx-a11y/media-has-caption -- no caption track for remote files
            <audio controls preload="metadata" src={file.url} style={{width: '100%'}} />
          ) : (
            <PlayIcon />
          )}
        </Flex>
      </Card>
    )
  }

  return (
    <Card tone="transparent" padding={4} style={{height}}>
      <Flex align="center" height="fill" justify="center" direction="column" gap={1}>
        <DocumentIcon />
        <Text align="center" muted size={1} textOverflow="ellipsis">
          {file.contentType || 'Remote file'}
        </Text>
      </Flex>
    </Card>
  )
}
