import {Box, Card, Container, Heading, Stack, Text} from '@sanity/ui'
import type {RemoteFilesProvider} from '../types'
import {RemoteFilesBrowser} from './RemoteFilesBrowser'

type RemoteFilesToolProps = {
  providers: RemoteFilesProvider[]
  title: string
  description: string
}

/** Studio tool: a full-page browser for managing remote files. */
export function RemoteFilesTool({description, providers, title}: RemoteFilesToolProps) {
  return (
    <Box paddingY={4} paddingX={[4, 5]} sizing="border">
      <Container width={5}>
        <Stack gap={5}>
          <Stack gap={3}>
            <Heading size={3}>{title}</Heading>
            <Text muted size={1}>
              {description}
            </Text>
          </Stack>
          {providers.length ? (
            <RemoteFilesBrowser providers={providers} />
          ) : (
            <Card border padding={4} radius={2} tone="caution">
              <Text>No remote file providers configured.</Text>
            </Card>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
