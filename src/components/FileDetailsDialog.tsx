import {Box, Button, Card, Dialog, Flex, Grid, Spinner, Stack, Tab, TabList, TabPanel, Text, TextInput, Tooltip, useToast} from '@sanity/ui'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {ClockIcon} from '@sanity/icons/Clock'
import {CopyIcon} from '@sanity/icons/Copy'
import {DocumentIcon} from '@sanity/icons/Document'
import {DownloadIcon} from '@sanity/icons/Download'
import {ExpandIcon} from '@sanity/icons/Expand'
import {HashIcon} from '@sanity/icons/Hash'
import {ImageIcon} from '@sanity/icons/Image'
import {LinkIcon} from '@sanity/icons/Link'
import {ListIcon} from '@sanity/icons/List'
import {TrashIcon} from '@sanity/icons/Trash'
import {UploadIcon} from '@sanity/icons/Upload'
import {useEffect, useRef, useState} from 'react'
import type {ComponentType, CSSProperties} from 'react'
import {useClient} from 'sanity'
import {IntentLink} from 'sanity/router'
import type {RemoteFileDocument, RemoteFilesProvider} from '../types'
import {deleteRemoteFile} from '../api'
import {formatDate, formatFileInfo, formatFileInfoParts, isPreviewableVideo} from '../format'
import {getRemoteMetadata} from '../metadata'
import {FilePreview} from './FilePreview'

type FileDetailsDialogProps = {
  file: RemoteFileDocument
  provider?: RemoteFilesProvider
  onClose: () => void
  onDelete?: (file: RemoteFileDocument) => Promise<void>
  onSelect?: (file: RemoteFileDocument) => void
  onUpdate?: (file: RemoteFileDocument) => void
}

type DialogTab = 'details' | 'poster' | 'usedBy'

type UsedByDocument = {
  _id: string
  _type: string
  name?: string
  title?: string
  updatedAt?: string
}

type IconComponent = ComponentType<{style?: CSSProperties}>

const usedByQuery = `*[_type != "remoteFiles.file" && references($id)] | order(_updatedAt desc) [0...50] {
  _id,
  _type,
  _updatedAt,
  "name": coalesce(name, title, heading, _id),
  "updatedAt": _updatedAt
}`

function InfoCard({icon: Icon, label, value}: {icon: IconComponent; label: string; value?: string}) {
  return (
    <Card border padding={3} radius={2} tone="transparent" style={{backgroundColor: 'transparent'}}>
      <Flex align="flex-start" gap={3}>
        <Icon style={{width: 20, height: 20}} />
        <Stack gap={2} flex={1}>
          <Text muted size={1} weight="semibold">
            {label}
          </Text>
          <Text size={1} style={{lineHeight: 1.35, overflowWrap: 'anywhere'}}>
            {value || 'Unknown'}
          </Text>
        </Stack>
      </Flex>
    </Card>
  )
}

function InfoRow({icon: Icon, label, value}: {icon: IconComponent; label: string; value: string}) {
  return (
    <Flex align="flex-start" gap={3}>
      <Icon style={{width: 20, height: 20}} />
      <Stack gap={2} flex={1}>
        <Text muted size={1} weight="semibold">
          {label}
        </Text>
        <Tooltip content={<Text size={1} style={{maxWidth: 520, overflowWrap: 'anywhere'}}>{value}</Text>} placement="top" portal>
          <code
            style={{
              display: 'block',
              fontSize: 'inherit',
              lineHeight: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </code>
        </Tooltip>
      </Stack>
    </Flex>
  )
}

/**
 * Details modal for a file.
 * Shows metadata, lets the editor set an internal title,
 * and provides download/copy/delete/select actions.
 */
export function FileDetailsDialog({file, provider, onClose, onDelete, onSelect, onUpdate}: FileDetailsDialogProps) {
  const client = useClient({apiVersion: '2025-01-01'})
  const toast = useToast()
  const posterInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<DialogTab>('details')
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [posterUploading, setPosterUploading] = useState(false)
  const [posterUrl, setPosterUrl] = useState(file.posterUrl)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(file.title || '')
  const [duration, setDuration] = useState<number | undefined>(file.duration)
  const [height, setHeight] = useState<number | undefined>(file.height)
  const [usedBy, setUsedBy] = useState<UsedByDocument[]>([])
  const [usedByLoading, setUsedByLoading] = useState(false)
  const [usedByLoaded, setUsedByLoaded] = useState(false)
  const [width, setWidth] = useState<number | undefined>(file.width)
  const fileInfo = formatFileInfoParts({...file, duration, height, width})
  const isVideo = isPreviewableVideo(file.contentType)

  useEffect(() => {
    setTitle(file.title || '')
    setPosterUrl(file.posterUrl)
    if (!isPreviewableVideo(file.contentType)) setActiveTab('details')
  }, [file._id, file.contentType, file.posterUrl, file.title])

  // Best-effort: probe metadata from the remote URL if not stored yet.
  // If successful, persist it so it doesn't need to be probed again.
  useEffect(() => {
    let cancelled = false
    setDuration(file.duration)
    setHeight(file.height)
    setWidth(file.width)

    const needsDuration = !file.duration
    const needsDimensions = !file.width || !file.height
    if (!needsDuration && !needsDimensions) {
      return
    }

    getRemoteMetadata(file.url, file.contentType).then(async (metadata) => {
      if (cancelled) return
      const patch: Pick<RemoteFileDocument, 'duration' | 'height' | 'width'> = {}
      if (needsDuration && metadata.duration) {
        patch.duration = metadata.duration
        setDuration(metadata.duration)
      }
      if (needsDimensions && metadata.width && metadata.height) {
        patch.width = metadata.width
        patch.height = metadata.height
        setWidth(metadata.width)
        setHeight(metadata.height)
      }
      if (!Object.keys(patch).length) {
        return
      }

      try {
        const updated = (await client.patch(file._id).set(patch).commit()) as RemoteFileDocument
        onUpdate?.(updated)
      } catch {
        // Metadata is best-effort — the UI can still show computed values.
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, file._id, file.contentType, file.duration, file.height, file.url, file.width, onUpdate])

  useEffect(() => {
    if (activeTab !== 'usedBy' || usedByLoaded) return

    let cancelled = false
    setUsedByLoading(true)
    client
      .fetch<UsedByDocument[]>(usedByQuery, {id: file._id})
      .then((documents) => {
        if (cancelled) return
        setUsedBy(documents)
        setUsedByLoaded(true)
      })
      .catch((error) => {
        if (cancelled) return
        toast.push({
          status: 'error',
          title: 'Could not load document usage',
          description: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        if (!cancelled) setUsedByLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, client, file._id, toast, usedByLoaded])

  async function handleSave() {
    setSaving(true)
    try {
      const updated = (await client
        .patch(file._id)
        .set({title: title || undefined})
        .commit()) as RemoteFileDocument
      onUpdate?.(updated)
      toast.push({status: 'success', title: 'File title saved'})
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Could not save file title',
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(file.url)
    toast.push({status: 'success', title: 'URL copied'})
  }

  async function handlePosterUpload(nextPoster: File) {
    if (!nextPoster.type.startsWith('image/')) {
      toast.push({status: 'error', title: 'Poster must be an image'})
      return
    }

    setPosterUploading(true)
    try {
      const asset = await client.assets.upload('image', nextPoster, {filename: nextPoster.name})
      const updated = (await client
        .patch(file._id)
        .set({poster: {_type: 'image', asset: {_type: 'reference', _ref: asset._id}}})
        .commit()) as RemoteFileDocument

      setPosterUrl(asset.url)
      onUpdate?.({...updated, posterUrl: asset.url})
      toast.push({status: 'success', title: 'Poster saved'})
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Could not save poster',
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setPosterUploading(false)
    }
  }

  async function handleRemovePoster() {
    setPosterUploading(true)
    try {
      const updated = (await client.patch(file._id).unset(['poster']).commit()) as RemoteFileDocument
      setPosterUrl(undefined)
      onUpdate?.({...updated, posterUrl: undefined})
      toast.push({status: 'success', title: 'Poster removed'})
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Could not remove poster',
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setPosterUploading(false)
    }
  }

  async function handleDelete() {
    if (!provider) return
    setDeleting(true)
    try {
      await deleteRemoteFile(provider, file)
      await onDelete?.(file)
      toast.push({status: 'success', title: 'File deleted'})
      onClose()
    } catch (error) {
      toast.push({
        status: 'error',
        title: 'Could not delete file',
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog header={file.title || file.filename} id="remote-file-details" onClickOutside={onClose} onClose={onClose} width={1}>
      <Stack gap={4} padding={4}>
        <Card border radius={2} overflow="hidden">
          <FilePreview controls file={file} height={360} />
        </Card>

        <Stack gap={3}>
          <TabList gap={2}>
            <Tab
              aria-controls="remote-file-details-panel"
              icon={ListIcon}
              id="remote-file-details-tab"
              label="Details"
              onClick={() => setActiveTab('details')}
              selected={activeTab === 'details'}
            />
            {isVideo && (
              <Tab
                aria-controls="remote-file-poster-panel"
                icon={ImageIcon}
                id="remote-file-poster-tab"
                label="Poster"
                onClick={() => setActiveTab('poster')}
                selected={activeTab === 'poster'}
              />
            )}
            <Tab
              aria-controls="remote-file-used-by-panel"
              icon={LinkIcon}
              id="remote-file-used-by-tab"
              label="Used by"
              onClick={() => setActiveTab('usedBy')}
              selected={activeTab === 'usedBy'}
            />
          </TabList>

          <TabPanel
            aria-labelledby="remote-file-details-tab"
            hidden={activeTab !== 'details'}
            id="remote-file-details-panel"
          >
            <Stack gap={4} paddingTop={2}>
              <Grid gridTemplateColumns={[1, 1, 2]} gap={2}>
                <InfoCard icon={CalendarIcon} label="Upload date" value={fileInfo.uploadedAt} />
                <InfoCard icon={DownloadIcon} label="File size" value={fileInfo.size} />
                <InfoCard icon={DocumentIcon} label="File type" value={fileInfo.contentType} />
                {fileInfo.duration && <InfoCard icon={ClockIcon} label="Duration" value={fileInfo.duration} />}
                {fileInfo.dimensions && <InfoCard icon={ExpandIcon} label="Dimensions" value={fileInfo.dimensions} />}
              </Grid>

              <Stack gap={2}>
                <Text size={1} weight="semibold">
                  Internal title
                </Text>
                <Text muted size={1}>
                  Not visible to users. Useful for finding files later.
                </Text>
                <Box marginTop={2}>
                  <TextInput
                    onChange={(event) => setTitle(event.currentTarget.value)}
                    placeholder="Ex: Customer testimonial video"
                    value={title}
                  />
                </Box>
              </Stack>

              <Stack gap={3} style={{paddingBlock: '1em', borderBlock: '1px solid var(--card-border-color)'}}>
                <InfoRow icon={LinkIcon} label="URL" value={file.url} />
                <InfoRow icon={HashIcon} label="Storage key" value={file.key} />
              </Stack>

              <Flex align="center" gap={3} justify="space-between" wrap="wrap">
                <Flex gap={2} wrap="wrap">
                  <Button as="a" href={file.url} icon={DownloadIcon} mode="ghost" target="_blank" text="Download" />
                  <Button icon={CopyIcon} mode="ghost" onClick={handleCopyUrl} text="Copy URL" />
                  {provider && (
                    <Button
                      icon={TrashIcon}
                      loading={deleting}
                      mode="ghost"
                      onClick={() => setConfirmDeleteOpen(true)}
                      text="Delete"
                      tone="critical"
                    />
                  )}
                </Flex>
                <Flex gap={2} wrap="wrap">
                  <Button mode="bleed" onClick={onClose} text="Close" />
                  <Button loading={saving} onClick={handleSave} text="Save" tone="primary" />
                  {onSelect && <Button onClick={() => onSelect(file)} text="Select" />}
                </Flex>
              </Flex>
            </Stack>
          </TabPanel>

          {isVideo && <TabPanel
            aria-labelledby="remote-file-poster-tab"
            hidden={activeTab !== 'poster'}
            id="remote-file-poster-panel"
          >
            <Stack gap={4} paddingTop={2}>
              <Stack gap={2}>
                <Text size={1} weight="semibold">
                  Poster image
                </Text>
                <Text muted size={1}>
                  A lightweight preview image displayed before playback starts, usually the video's first frame.
                </Text>
              </Stack>

              {posterUrl && (
                <Card border radius={2} overflow="hidden" style={{maxWidth: 280}}>
                  <img
                    alt={`Poster for ${file.title || file.filename}`}
                    src={posterUrl}
                    style={{display: 'block', maxHeight: 180, objectFit: 'contain', width: '100%'}}
                  />
                </Card>
              )}

              <input
                accept="image/*"
                hidden
                onChange={(event) => {
                  const nextPoster = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (nextPoster) void handlePosterUpload(nextPoster)
                }}
                ref={posterInputRef}
                type="file"
              />

              <Flex gap={2} wrap="wrap">
                <Button
                  icon={UploadIcon}
                  loading={posterUploading}
                  onClick={() => posterInputRef.current?.click()}
                  text={posterUrl ? 'Replace poster' : 'Upload poster'}
                  tone={posterUrl ? 'default' : 'primary'}
                />
                {posterUrl && (
                  <Button
                    icon={TrashIcon}
                    loading={posterUploading}
                    mode="ghost"
                    onClick={handleRemovePoster}
                    text="Remove poster"
                    tone="critical"
                  />
                )}
              </Flex>
            </Stack>
          </TabPanel>}

          <TabPanel
            aria-labelledby="remote-file-used-by-tab"
            hidden={activeTab !== 'usedBy'}
            id="remote-file-used-by-panel"
          >
            <Stack gap={3} paddingTop={2}>
              {usedByLoading ? (
                <Card padding={5} tone="transparent">
                  <Flex align="center" gap={3} justify="center">
                    <Spinner muted />
                    <Text muted>Loading document usage</Text>
                  </Flex>
                </Card>
              ) : usedBy.length ? (
                <Stack gap={2}>
                  {usedBy.map((document) => (
                    <IntentLink
                      intent="edit"
                      key={document._id}
                      params={{id: document._id, type: document._type}}
                      style={{color: 'inherit', display: 'block', textDecoration: 'none'}}
                    >
                      <Card border padding={3} radius={2} tone="transparent" style={{backgroundColor: 'transparent', cursor: 'pointer'}}>
                        <Flex align="center" justify="space-between" gap={3} wrap="wrap">
                          <Stack gap={3} flex={1}>
                            <Text size={2} weight="semibold">
                              {document.name || document._id}
                            </Text>
                            <Text muted size={1}>
                              Updated {formatDate(document.updatedAt)}
                            </Text>
                          </Stack>
                          <Text muted size={1}>
                            {document._type}
                          </Text>
                        </Flex>
                      </Card>
                    </IntentLink>
                  ))}
                </Stack>
              ) : (
                <Card border padding={4} radius={2} tone="transparent">
                  <Stack gap={2}>
                    <Text weight="semibold">Not used yet</Text>
                    <Text muted size={1}>
                      No documents currently reference this file.
                    </Text>
                  </Stack>
                </Card>
              )}
            </Stack>
          </TabPanel>
        </Stack>

        {confirmDeleteOpen && (
          <Dialog
            header="Delete file?"
            id="remote-file-delete-confirm"
            onClose={() => setConfirmDeleteOpen(false)}
            width={0}
          >
            <Stack gap={4} padding={4}>
              <Text size={1}>
                This will delete <strong>{file.title || file.filename}</strong> from the remote storage provider and remove it from Sanity.
              </Text>
              <Text muted size={1}>
                This cannot be undone.
              </Text>
              <Flex gap={2} justify="flex-end">
                <Button mode="bleed" onClick={() => setConfirmDeleteOpen(false)} text="Cancel" />
                <Button icon={TrashIcon} loading={deleting} onClick={handleDelete} text="Delete file" tone="critical" />
              </Flex>
            </Stack>
          </Dialog>
        )}
      </Stack>
    </Dialog>
  )
}
