import {SearchIcon} from '@sanity/icons/Search'
import {UploadIcon} from '@sanity/icons/Upload'
import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Select,
  Spinner,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui'
import {useToast} from '@sanity/ui/toast'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useClient} from 'sanity'

import {acceptErrorToast, acceptToGroq, matchesAccept} from '../accept'
import {REMOTE_FILE_PROJECTION, useRemoteFileUpload} from '../hooks'
import type {RemoteFileDocument, RemoteFilesProvider} from '../types'
import {FileCard, fileCardStyles} from './FileCard'
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

type FileCounts = {all: number; used: number}

const FILE_LIMIT = 200
const USED_CLAUSE = 'count(*[_type != "remoteFiles.file" && references(^._id)]) > 0'

function buildFilter(accept?: string) {
  return [
    '_type == "remoteFiles.file"',
    '(!defined($provider) || provider == $provider)',
    acceptToGroq(accept),
  ]
    .filter(Boolean)
    .join(' && ')
}

// The search clause is only added when there's a term, to avoid
// referencing the $search param when it's not provided.
function buildFilesQuery(accept?: string, searching?: boolean, usage?: string) {
  const clauses = [
    buildFilter(accept),
    searching ? '(filename match $search || title match $search)' : null,
    usage === 'used' ? USED_CLAUSE : usage === 'unused' ? `!(${USED_CLAUSE})` : null,
  ].filter(Boolean)

  return `*[${clauses.join(' && ')}] | order(uploadedAt desc) [0...${FILE_LIMIT}] ${REMOTE_FILE_PROJECTION}`
}

function buildCountsQuery(accept?: string) {
  const filter = buildFilter(accept)
  return `{"all": count(*[${filter}]), "used": count(*[${filter} && ${USED_CLAUSE}])}`
}

function withCount(label: string, count?: number) {
  return count === undefined ? label : `${label} (${count})`
}

function UploadProgressDialog({
  fileName,
  progress,
  stage,
}: {
  fileName: string
  progress?: number
  stage: 'uploading' | 'saving'
}) {
  const progressLabel = typeof progress === 'number' ? `${progress}%` : 'Uploading...'

  return (
    <Dialog
      header="Uploading file"
      id="remote-file-upload-progress"
      onClose={() => undefined}
      width={0}
    >
      <Stack gap={4} padding={4}>
        <Stack gap={3}>
          <Text weight="semibold">{fileName}</Text>
          <Text muted size={1}>
            {stage === 'saving' ? 'Saving file metadata...' : progressLabel}
          </Text>
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
            <Text muted size={1}>
              Waiting for the provider...
            </Text>
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
export function RemoteFilesBrowser({
  accept,
  initialProvider,
  providers,
  onRemoveSelected,
  onSelect,
  selectedFileId,
}: RemoteFilesBrowserProps) {
  const client = useClient({apiVersion: '2025-01-01'})
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<RemoteFileDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RemoteFileDocument | null>(null)
  const [search, setSearch] = useState('')
  const [usage, setUsage] = useState('all')
  const [counts, setCounts] = useState<FileCounts>()
  const [providerId, setProviderId] = useState(initialProvider || providers[0]?.id || '')
  const provider = useMemo(() => getProvider(providers, providerId), [providerId, providers])
  const {upload, uploading, uploadProgress} = useRemoteFileUpload(provider)

  const loadFiles = useCallback(
    async (isStale: () => boolean) => {
      setLoading(true)
      try {
        const wildcard = search.trim() ? `${search.trim()}*` : null
        const nextFiles = await client.fetch<RemoteFileDocument[]>(
          buildFilesQuery(accept, Boolean(wildcard), usage),
          {provider: provider?.id || null, ...(wildcard ? {search: wildcard} : {})},
        )
        if (isStale()) return
        setFiles(
          nextFiles.filter((file) =>
            matchesAccept(accept, {contentType: file.contentType, filename: file.filename}),
          ),
        )
      } catch (error) {
        if (isStale()) return
        toast.push({
          status: 'error',
          title: 'Could not load remote files',
          description: error instanceof Error ? error.message : String(error),
        })
      } finally {
        if (!isStale()) setLoading(false)
      }
    },
    [accept, client, provider, search, toast, usage],
  )

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => void loadFiles(() => cancelled), 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [loadFiles])

  // Not tied to search, so typing does not recount
  useEffect(() => {
    let cancelled = false
    const loadCounts = async () => {
      try {
        const nextCounts = await client.fetch<FileCounts>(buildCountsQuery(accept), {
          provider: provider?.id || null,
        })
        if (!cancelled) setCounts(nextCounts)
      } catch {
        // Labels fall back to no counts
      }
    }
    void loadCounts()
    return () => {
      cancelled = true
    }
  }, [accept, client, provider])

  function addToCount(amount: number) {
    setCounts((current) => current && {...current, all: current.all + amount})
  }

  async function handleUpload(file: File) {
    if (!matchesAccept(accept, file)) {
      toast.push(acceptErrorToast(accept))
      return
    }

    const document = await upload(file)
    if (document) {
      setFiles((current) => [document, ...current])
      addToCount(1)
      onSelect?.(document)
    }
  }

  function handleDeleted(file: RemoteFileDocument) {
    setFiles((current) => current.filter((item) => item._id !== file._id))
    addToCount(-1)
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
              placeholder={counts ? `Search from ${counts.all} files` : 'Search files'}
              value={search}
            />
          </Box>
          <Box style={{minWidth: 160}}>
            <Select onChange={(event) => setUsage(event.currentTarget.value)} value={usage}>
              <option value="all">{withCount('All files', counts?.all)}</option>
              <option value="used">{withCount('Used in documents', counts?.used)}</option>
              <option value="unused">
                {withCount('Not used', counts && counts.all - counts.used)}
              </option>
            </Select>
          </Box>
          {providers.length > 1 && (
            <Box style={{minWidth: 160}}>
              <Select
                onChange={(event) => setProviderId(event.currentTarget.value)}
                value={provider?.id || ''}
              >
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
        <Button
          icon={UploadIcon}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
          text="Upload file"
          tone="primary"
        />
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
        <Stack gap={3}>
          <style>{fileCardStyles}</style>
          <Grid gap={4} style={{gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'}}>
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
          {files.length === FILE_LIMIT && (
            <Text muted size={1}>
              Showing the {FILE_LIMIT} most recent files. Search to narrow the list.
            </Text>
          )}
        </Stack>
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
          onDeleted={handleDeleted}
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
