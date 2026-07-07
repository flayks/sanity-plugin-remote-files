import {Box, Button, Card, Dialog, Flex, Stack, Text, useToast} from '@sanity/ui'
import {CloseIcon} from '@sanity/icons/Close'
import {SearchIcon} from '@sanity/icons/Search'
import {UploadIcon} from '@sanity/icons/Upload'
import {useEffect, useMemo, useRef, useState} from 'react'
import {set, unset, useClient} from 'sanity'
import type {RemoteFileDocument, RemoteFileFieldOptions, RemoteFileInputProps} from '../types'
import {formatBytes, formatDate, formatDuration} from '../format'
import {REMOTE_FILE_PROJECTION, useRemoteFileUpload} from '../hooks'
import {matchesAccept} from '../accept'
import {FilePreview} from './FilePreview'
import {getProvider, useRemoteFilesProviders} from './ProviderContext'
import {RemoteFilesBrowser} from './RemoteFilesBrowser'

/**
 * Custom input for `remoteFile` fields. Lets editors upload a new file,
 * select an existing one, or remove the current reference.
 */
export function RemoteFileInput(props: RemoteFileInputProps) {
  const {onChange, readOnly, schemaType, value} = props
  const client = useClient({apiVersion: '2025-01-01'})
  const toast = useToast()
  const providers = useRemoteFilesProviders()
  const options = (schemaType.options || {}) as RemoteFileFieldOptions
  const provider = useMemo(() => getProvider(providers, options.provider), [options.provider, providers])
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<RemoteFileDocument | null>(null)
  const [browserOpen, setBrowserOpen] = useState(false)
  const {upload, uploading} = useRemoteFileUpload(provider)

  // Fetch the referenced file document when the value changes
  useEffect(() => {
    const ref = value?.asset?._ref
    if (!ref) {
      setFile(null)
      return
    }
    let cancelled = false
    client
      .fetch<RemoteFileDocument | null>(`*[_id == $id][0] ${REMOTE_FILE_PROJECTION}`, {id: ref})
      .then((nextFile) => {
        if (!cancelled) setFile(nextFile)
      })
    return () => {
      cancelled = true
    }
  }, [client, value?.asset?._ref])

  function selectFile(nextFile: RemoteFileDocument) {
    if (!matchesAccept(options.accept, {contentType: nextFile.contentType, filename: nextFile.filename})) {
      toast.push({status: 'error', title: 'File type not allowed', description: `This field accepts: ${options.accept}`})
      return
    }

    onChange(set({_type: 'remoteFile', asset: {_type: 'reference', _ref: nextFile._id}}))
    setFile(nextFile)
    setBrowserOpen(false)
  }

  async function handleUpload(nextUpload: File) {
    if (!matchesAccept(options.accept, nextUpload)) {
      toast.push({status: 'error', title: 'File type not allowed', description: `This field accepts: ${options.accept}`})
      return
    }

    const document = await upload(nextUpload)
    if (document) selectFile(document)
  }

  function removeFile() {
    onChange(unset())
    setFile(null)
  }

  return (
    <Stack gap={3}>
      {file ? (
        <Card border radius={2} overflow="hidden">
          <FilePreview file={file} fit="contain" height={320} />
          <Stack padding={3} gap={3}>
            <Text size={2} weight="semibold">
              {file.title || file.filename}
            </Text>
            <Text muted size={1}>
              {[file.contentType || 'Remote file', formatDuration(file.duration), formatBytes(file.size), formatDate(file.uploadedAt)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Flex gap={2} wrap="wrap">
              <Button disabled={readOnly} icon={UploadIcon} loading={uploading} mode="ghost" onClick={() => inputRef.current?.click()} text="Upload" />
              <Button disabled={readOnly} icon={SearchIcon} mode="ghost" onClick={() => setBrowserOpen(true)} text="Select" />
              <Button disabled={readOnly} icon={CloseIcon} mode="ghost" onClick={removeFile} text="Remove" tone="critical" />
            </Flex>
          </Stack>
        </Card>
      ) : (
        <Card border padding={4} radius={2} tone="transparent">
          <Stack gap={3}>
            <Text weight="semibold">No remote file selected</Text>
            <Text muted size={1}>
              Upload a new file or select one from the remote file library.
            </Text>
            <Flex gap={2} wrap="wrap">
              <Button
                disabled={readOnly || !provider}
                icon={UploadIcon}
                loading={uploading}
                onClick={() => inputRef.current?.click()}
                text="Upload"
                tone="primary"
              />
              <Button disabled={readOnly} icon={SearchIcon} mode="ghost" onClick={() => setBrowserOpen(true)} text="Select" />
            </Flex>
          </Stack>
        </Card>
      )}

      <input
        accept={options.accept}
        hidden
        onChange={(event) => {
          const nextFile = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (nextFile) void handleUpload(nextFile)
        }}
        ref={inputRef}
        type="file"
      />

      {browserOpen && (
        <Dialog
          header="Select remote file"
          id="remote-file-browser"
          onClickOutside={() => setBrowserOpen(false)}
          onClose={() => setBrowserOpen(false)}
          width={4}
        >
          <Box padding={4}>
            <RemoteFilesBrowser
              accept={options.accept}
              initialProvider={provider?.id}
              onRemoveSelected={removeFile}
              onSelect={selectFile}
              providers={providers}
              selectedFileId={file?._id}
            />
          </Box>
        </Dialog>
      )}
    </Stack>
  )
}
