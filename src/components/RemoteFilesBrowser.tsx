import {Box, Button, Card, Dialog, Flex, Grid, Select, Spinner, Stack, Text, TextInput, useToast} from '@sanity/ui'
import {SearchIcon} from '@sanity/icons/Search'
import {UploadIcon} from '@sanity/icons/Upload'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useClient} from 'sanity'
import type {RemoteFileDocument, RemoteFilesProvider} from '../types'
import {REMOTE_FILE_PROJECTION, useRemoteFileUpload} from '../hooks'
import {matchesAccept} from '../accept'
import {FileCard} from './FileCard'
import {FileDetailsDialog} from './FileDetailsDialog'
import {getProvider} from './ProviderContext'

type RemoteFilesBrowserProps = {
  accept?: string
  initialProvider?: string
  providers: RemoteFilesProvider[]
  onRemoveSelected?: () => void
  onSelect?: (file: RemoteFileDocument) => void
  selectedFileId?: string
}

// Two queries: one for listing, one for search.
// The search query is only used when there's a search term to avoid
// referencing the $search param when it's not provided.
const filesQuery = `*[_type == "remoteFiles.file" && (!defined($provider) || provider == $provider)] | order(uploadedAt desc) [0...200] ${REMOTE_FILE_PROJECTION}`
const searchFilesQuery = `*[_type == "remoteFiles.file" && (!defined($provider) || provider == $provider) && (filename match $search || title match $search)] | order(uploadedAt desc) [0...200] ${REMOTE_FILE_PROJECTION}`

function UploadProgressDialog({fileName, progress, stage}: {fileName: string; progress?: number; stage: 'uploading' | 'saving'}) {
  const progressLabel = typeof progress === 'number' ? `${progress}%` : 'Uploading...'

  return (
    <Dialog header="Uploading file" id="remote-file-upload-progress" onClose={() => undefined} width={0}>
      <Stack gap={4} padding={4}>
        <Stack gap={3}>
          <Text weight="semibold">{fileName}</Text>
          <Text muted size={1}>{stage === 'saving' ? 'Saving file metadata...' : progressLabel}</Text>
        </Stack>

        {typeof progress === 'number' ? (
          <Card border radius={3} overflow="hidden" tone="transparent" style={{height: 8}}>
            <div
              style={{
                background: 'currentColor',
                height: '100%',
                opacity: 0.65,
                transition: 'width 160ms ease',
                width: `${progress}%`,
              }}
            />
          </Card>
        ) : (
          <Flex align="center" gap={3}>
            <Spinner muted />
            <Text muted size={1}>Waiting for the provider...</Text>
          </Flex>
        )}
      </Stack>
    </Dialog>
  )
}

/**
 * Browser grid for remote files. Used both in the Studio tool
 * and inside the field input's "Select" dialog.
 */
export function RemoteFilesBrowser({accept, initialProvider, providers, onRemoveSelected, onSelect, selectedFileId}: RemoteFilesBrowserProps) {
  const client = useClient({apiVersion: '2025-01-01'})
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<RemoteFileDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RemoteFileDocument | null>(null)
  const [search, setSearch] = useState('')
  const [providerId, setProviderId] = useState(initialProvider || providers[0]?.id || '')
  const provider = useMemo(() => getProvider(providers, providerId), [providerId, providers])
  const {upload, uploading, uploadProgress} = useRemoteFileUpload(provider)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const wildcard = search.trim() ? `${search.trim()}*` : null
      const nextFiles = wildcard
        ? await client.fetch<RemoteFileDocument[]>(searchFilesQuery, {provider: provider?.id || null, search: wildcard})
        : await client.fetch<RemoteFileDocument[]>(filesQuery, {provider: provider?.id || null})
      setFiles(nextFiles.filter((file) => matchesAccept(accept, {contentType: file.contentType, filename: file.filename})))
    } finally {
      setLoading(false)
    }
  }, [accept, client, provider?.id, search])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFiles(), 150)
    return () => window.clearTimeout(timer)
  }, [loadFiles])

  async function handleUpload(file: File) {
    if (!matchesAccept(accept, file)) {
      toast.push({status: 'error', title: 'File type not allowed', description: `This field accepts: ${accept}`})
      return
    }

    const document = await upload(file)
    if (document) {
      setFiles((current) => [document, ...current])
      onSelect?.(document)
    }
  }

  async function handleDelete(file: RemoteFileDocument) {
    await client.delete(file._id)
    setFiles((current) => current.filter((item) => item._id !== file._id))
  }

  function handleUpdate(file: RemoteFileDocument) {
    setFiles((current) => current.map((item) => (item._id === file._id ? file : item)))
    setSelected(file)
  }

  return (
    <Stack gap={5}>
      <Flex align="center" gap={3} justify="space-between" wrap="wrap">
        <Flex align="center" flex={1} gap={3} style={{minWidth: 320}}>
          <Box flex={1} style={{minWidth: 220}}>
            <TextInput
              clearButton={Boolean(search)}
              icon={SearchIcon}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onClear={() => setSearch('')}
              placeholder="Search files"
              value={search}
            />
          </Box>
          {providers.length > 1 && (
            <Box style={{minWidth: 160}}>
              <Select onChange={(event) => setProviderId(event.currentTarget.value)} value={provider?.id || ''}>
                {providers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </Select>
            </Box>
          )}
        </Flex>
        <input
          accept={accept}
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void handleUpload(file)
          }}
          ref={inputRef}
          type="file"
        />
        <Button icon={UploadIcon} loading={uploading} onClick={() => inputRef.current?.click()} text="Upload file" tone="primary" />
      </Flex>

      {accept && (
        <Text muted size={1}>
          Showing files matching <code>{accept}</code>
        </Text>
      )}

      {loading ? (
        <Card padding={5} tone="transparent">
          <Flex align="center" gap={3} justify="center">
            <Spinner muted />
            <Text muted>Loading files</Text>
          </Flex>
        </Card>
      ) : files.length ? (
        <Grid gap={4} style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
          {files.map((file) => (
            <FileCard
              file={file}
              key={file._id}
              onOpen={setSelected}
              onRemoveSelected={onRemoveSelected}
              onSelect={onSelect}
              selected={file._id === selectedFileId}
            />
          ))}
        </Grid>
      ) : (
        <Card border padding={5} radius={2} tone="transparent">
          <Stack gap={3}>
            <Text weight="semibold">No remote files yet</Text>
            <Text muted size={1}>
              Upload a file to start building your remote library.
            </Text>
          </Stack>
        </Card>
      )}

      {selected && (
        <FileDetailsDialog
          file={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onSelect={onSelect}
          onUpdate={handleUpdate}
          provider={getProvider(providers, selected.provider)}
        />
      )}

      {uploadProgress && (
        <UploadProgressDialog
          fileName={uploadProgress.fileName}
          progress={uploadProgress.progress}
          stage={uploadProgress.stage}
        />
      )}
    </Stack>
  )
}
