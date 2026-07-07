import {Box, Button, Card, Dialog, Flex, Grid, Spinner, Stack, Tab, TabList, TabPanel, Text, TextInput, Tooltip, useToast} from '@sanity/ui'
import {CalendarIcon} from '@sanity/icons/Calendar'
import {ClockIcon} from '@sanity/icons/Clock'
import {CopyIcon} from '@sanity/icons/Copy'
import {DocumentIcon} from '@sanity/icons/Document'
import {DownloadIcon} from '@sanity/icons/Download'
import {HashIcon} from '@sanity/icons/Hash'
import {LinkIcon} from '@sanity/icons/Link'
import {ListIcon} from '@sanity/icons/List'
import {TrashIcon} from '@sanity/icons/Trash'
import {useEffect, useState} from 'react'
import type {ComponentType, CSSProperties} from 'react'
import {useClient} from 'sanity'
import {IntentLink} from 'sanity/router'
import type {RemoteFileDocument, RemoteFilesProvider} from '../types'
import {deleteRemoteFile} from '../api'
import {formatBytes, formatDate, formatDuration} from '../format'
import {getRemoteDuration} from '../metadata'
import {FilePreview} from './FilePreview'

type FileDetailsDialogProps = {
  file: RemoteFileDocument
  provider?: RemoteFilesProvider
  onClose: () => void
  onDelete?: (file: RemoteFileDocument) => Promise<void>
  onSelect?: (file: RemoteFileDocument) => void
  onUpdate?: (file: RemoteFileDocument) => void
}

type DialogTab = 'details' | 'usedBy'

type UsedByDocument = {
  _id: string
  _type: string
  title?: string
  updatedAt?: string
}

type IconComponent = ComponentType<{style?: CSSProperties}>

const usedByQuery = `*[_type != "remoteFiles.file" && references($id)] | order(_updatedAt desc) [0...50] {
  _id,
  _type,
  _updatedAt,
  "title": coalesce(title, name, heading, _id),
  "updatedAt": _updatedAt
}`

function InfoCard({code, icon: Icon, label, value}: {code?: boolean; icon: IconComponent; label: string; value?: string}) {
  return (
    <Card border padding={3} radius={2} tone="transparent" style={{backgroundColor: 'transparent'}}>
      <Flex align="flex-start" gap={3}>
        <Icon style={{width: 20, height: 20}} />
        <Stack gap={2} flex={1}>
          <Text muted size={1} weight="semibold">
            {label}
          </Text>
          {code && value ? (
            <Tooltip
              content={<Text size={1} style={{maxWidth: 520, overflowWrap: 'anywhere'}}>{value}</Text>}
              placement="top"
              portal
            >
              <code
                style={{
                  display: 'block',
                  fontSize: 'inherit',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                {value}
              </code>
            </Tooltip>
          ) : (
            <Text size={1} style={{lineHeight: 1.35, overflowWrap: 'anywhere'}}>
              {value || 'Unknown'}
            </Text>
          )}
        </Stack>
      </Flex>
    </Card>
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
  const [activeTab, setActiveTab] = useState<DialogTab>('details')
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(file.title || '')
  const [duration, setDuration] = useState<number | undefined>(file.duration)
  const [usedBy, setUsedBy] = useState<UsedByDocument[]>([])
  const [usedByLoading, setUsedByLoading] = useState(false)
  const [usedByLoaded, setUsedByLoaded] = useState(false)
  const formattedDuration = formatDuration(duration)

  useEffect(() => {
    setTitle(file.title || '')
  }, [file._id, file.title])

  // Best-effort: probe duration from the remote URL if not stored yet.
  // If successful, persist it so it doesn't need to be probed again.
  useEffect(() => {
    let cancelled = false
    if (file.duration) {
      setDuration(file.duration)
      return
    }
    getRemoteDuration(file.url, file.contentType).then(async (next) => {
      if (cancelled || !next) return
      setDuration(next)
      try {
        const updated = (await client.patch(file._id).set({duration: next}).commit()) as RemoteFileDocument
        onUpdate?.(updated)
      } catch {
        // Duration is best-effort — the UI can still show the computed value.
      }
    })
    return () => {
      cancelled = true
    }
  }, [client, file._id, file.duration, file.url, file.contentType, onUpdate])

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
                <InfoCard icon={CalendarIcon} label="Upload date" value={formatDate(file.uploadedAt)} />
                <InfoCard icon={DownloadIcon} label="File size" value={formatBytes(file.size)} />
                <InfoCard icon={DocumentIcon} label="File type" value={file.contentType || 'Unknown type'} />
                {formattedDuration && <InfoCard icon={ClockIcon} label="Duration" value={formattedDuration} />}
                <InfoCard code icon={LinkIcon} label="URL" value={file.url} />
                <InfoCard code icon={HashIcon} label="Storage key" value={file.key} />
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
                          <Stack gap={2}>
                            <Text size={2} weight="semibold">
                              {document.title || document._id}
                            </Text>
                            <Text muted size={1}>
                              {document._type} · Updated {formatDate(document.updatedAt)}
                            </Text>
                          </Stack>
                          <Text muted size={1}>
                            {document._id}
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
