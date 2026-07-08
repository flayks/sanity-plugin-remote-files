import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {CheckmarkIcon} from '@sanity/icons/Checkmark'
import {ClockIcon} from '@sanity/icons/Clock'
import {CloseIcon} from '@sanity/icons/Close'
import {DownloadIcon} from '@sanity/icons/Download'
import {EyeOpenIcon} from '@sanity/icons/EyeOpen'
import type {RemoteFileDocument} from '../types'
import {formatBytes, formatDate, formatDuration} from '../format'
import {useDurationFallback} from '../hooks'
import {FilePreview} from './FilePreview'

type FileCardProps = {
  file: RemoteFileDocument
  onOpen: (file: RemoteFileDocument) => void
  onRemoveSelected?: () => void
  onSelect?: (file: RemoteFileDocument) => void
  selected?: boolean
}

/** Grid card showing a file preview and key metadata. */
export function FileCard({file, onOpen, onRemoveSelected, onSelect, selected}: FileCardProps) {
  const duration = formatDuration(useDurationFallback(file))

  return (
    <Card border className="remote-file-card" radius={2} overflow="hidden" style={selected ? {borderColor: '#16a34a', boxShadow: '0 0 0 1px #16a34a'} : undefined}>
      <style>{`
        .remote-file-card { transition: border-color 200ms }
        .remote-file-card:hover { border-color: #9ca3af }
        .remote-file-card .selected-remove { display: none }
        .remote-file-card:hover .selected-label { display: none }
        .remote-file-card:hover .selected-remove { display: block }
      `}</style>
      <button
        aria-label={`Open ${file.title || file.filename}`}
        onClick={() => onOpen(file)}
        style={{background: 'transparent', border: 0, cursor: 'pointer', display: 'block', padding: 0, width: '100%'}}
        type="button"
      >
        <FilePreview file={file} fit="contain" />
      </button>
      <Stack padding={3} gap={3}>
        <Text size={2} weight="semibold" textOverflow="ellipsis">
          {file.title || file.filename}
        </Text>
        <Flex wrap="wrap" style={{ gap: '0.5rem 0.75rem' }}>
          {duration && (
            <Flex align="center" gap={1}>
              <ClockIcon />
              <Text muted size={1}>{duration}</Text>
            </Flex>
          )}
          <Flex align="center" gap={1}>
            <DownloadIcon />
            <Text muted size={1}>{formatBytes(file.size)}</Text>
          </Flex>
          <Flex align="center" gap={1}>
            <CalendarIcon />
            <Text muted size={1}>{formatDate(file.uploadedAt)}</Text>
          </Flex>
        </Flex>
        <Flex gap={2} wrap="wrap">
          {onSelect && selected && onRemoveSelected ? (
            <>
              <Button
                className="selected-label"
                disabled
                icon={CheckmarkIcon}
                style={{flex: '1 1 auto'}}
                text="Selected"
                tone="positive"
              />
              <Button
                className="selected-remove"
                icon={CloseIcon}
                mode="ghost"
                onClick={onRemoveSelected}
                style={{flex: '1 1 auto'}}
                text="Remove"
                tone="critical"
              />
            </>
          ) : onSelect ? (
            <Button
              disabled={selected}
              icon={CheckmarkIcon}
              onClick={() => onSelect(file)}
              style={{flex: '1 1 auto'}}
              text={selected ? 'Selected' : 'Select'}
              tone="positive"
            />
          ) : null}
          <Button
            icon={EyeOpenIcon}
            mode="ghost"
            onClick={() => onOpen(file)}
            style={{flex: onSelect ? undefined : '1 1 auto'}}
            text="Details"
          />
        </Flex>
      </Stack>
    </Card>
  )
}
