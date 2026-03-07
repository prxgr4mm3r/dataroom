import { IconDownload, IconFolder } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { mapItemResourceDto, type ContentItem } from '@/entities/content-item'
import { apiClient, toApiError } from '@/shared/api'
import type { ItemResourceDto, ListItemsDto } from '@/shared/api'
import { routes } from '@/shared/config/routes'
import { formatDate } from '@/shared/lib/date/format-date'
import { downloadBlob } from '@/shared/lib/file/download-blob'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import type { SortBy, SortOrder } from '@/shared/types/common'
import { Alert, Badge, Box, Button, Center, FileTypeIcon, Group, Loader, Paper, Stack, Table, Text, Title } from '@/shared/ui'
import { notifyError } from '@/shared/ui'

import './shared-view-page.css'

type ShareMetaDto = {
  share: {
    id: string
    permission: string
    expires_at: string | null
    created_at: string
  }
  root: ItemResourceDto
}

type SharedFolderSummary = {
  id: string
  name: string
  parentId: string | null
}

type SharedListResult = {
  folder: SharedFolderSummary
  breadcrumbs: Array<{ id: string; name: string }>
  items: ContentItem[]
}

const normalizeFolderParentId = (folderId: string): string | null => (folderId === 'root' ? 'root' : folderId)

const getShareMeta = async (shareToken: string): Promise<ShareMetaDto> => {
  const response = await apiClient.get<ShareMetaDto>(`/api/public/shares/${encodeURIComponent(shareToken)}/meta`)
  return response.data
}

const listSharedItems = async (
  shareToken: string,
  folderId: string,
  sortBy: SortBy,
  sortOrder: SortOrder,
): Promise<SharedListResult> => {
  const response = await apiClient.get<ListItemsDto>(`/api/public/shares/${encodeURIComponent(shareToken)}/items`, {
    params: {
      parent_id: normalizeFolderParentId(folderId),
      sort_by: sortBy,
      sort_order: sortOrder,
    },
  })

  return {
    folder: {
      id: response.data.folder.id,
      name: response.data.folder.name,
      parentId: response.data.folder.parent_id,
    },
    breadcrumbs: response.data.breadcrumbs.map((crumb) => ({ id: crumb.id, name: crumb.name })),
    items: response.data.items.map(mapItemResourceDto),
  }
}

export const SharedViewPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [folderId, setFolderId] = useState('root')
  const [sortBy] = useState<SortBy>('name')
  const [sortOrder] = useState<SortOrder>('asc')
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null)

  useEffect(() => {
    setFolderId('root')
  }, [shareToken])

  const metaQuery = useQuery({
    queryKey: ['share-meta', shareToken],
    queryFn: async () => getShareMeta(String(shareToken)),
    enabled: Boolean(shareToken),
    retry: false,
  })

  const listQuery = useQuery({
    queryKey: ['share-items', shareToken, folderId, sortBy, sortOrder],
    queryFn: async () => listSharedItems(String(shareToken), folderId, sortBy, sortOrder),
    enabled: Boolean(shareToken) && metaQuery.isSuccess,
  })

  const headerTitle = useMemo(() => metaQuery.data?.root.name || 'Shared Data Room', [metaQuery.data?.root.name])
  const shareExpiresAt = metaQuery.data?.share.expires_at ?? null

  const downloadItem = async (item: ContentItem) => {
    setDownloadingItemId(item.id)
    try {
      const response = await apiClient.get<Blob>(
        `/api/public/shares/${encodeURIComponent(String(shareToken))}/items/${item.id}/content`,
        { responseType: 'blob' },
      )
      downloadBlob(response.data, item.name)
    } catch (error) {
      notifyError(toApiError(error).message)
    } finally {
      setDownloadingItemId(null)
    }
  }

  if (!shareToken) {
    return <Navigate to={routes.dataroomRoot} replace />
  }

  if (metaQuery.isPending) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }

  if (metaQuery.error) {
    return (
      <Center mih="100vh" p="md">
        <Paper withBorder p="lg" maw={640} w="100%">
          <Stack>
            <Title order={3}>Shared link unavailable</Title>
            <Alert color="red">{toApiError(metaQuery.error).message}</Alert>
          </Stack>
        </Paper>
      </Center>
    )
  }

  return (
    <Box className="shared-view-page">
      <Paper className="shared-view-page__card" withBorder shadow="sm">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Group gap="xs">
                <Title order={2}>{headerTitle}</Title>
                <Badge color="gray" variant="light">
                  Read-only
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {shareExpiresAt ? `Link expires: ${formatDate(shareExpiresAt)}` : 'No expiration'}
              </Text>
            </Stack>
          </Group>

          <Group gap={8} wrap="wrap">
            {(listQuery.data?.breadcrumbs ?? []).map((crumb, index) => (
              <Group gap={8} key={`${crumb.id}-${index}`} wrap="nowrap">
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => setFolderId(crumb.id)}
                  className="shared-view-page__crumb"
                >
                  {crumb.name}
                </Button>
                {index < (listQuery.data?.breadcrumbs.length ?? 0) - 1 ? (
                  <Text size="sm" c="dimmed">
                    /
                  </Text>
                ) : null}
              </Group>
            ))}
          </Group>

          {listQuery.error ? <Alert color="red">{toApiError(listQuery.error).message}</Alert> : null}

          <Box className="shared-view-page__table-wrap">
            {listQuery.isPending ? (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            ) : (
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Updated</Table.Th>
                    <Table.Th className="shared-view-page__actions-col">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(listQuery.data?.items ?? []).map((item) => {
                    const presentation = getFileTypePresentation(item.name, item.mimeType)
                    const isFolder = item.kind === 'folder'
                    return (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Group gap={8} wrap="nowrap">
                            {isFolder ? (
                              <IconFolder size={16} color="#1d4ed8" />
                            ) : (
                              <FileTypeIcon iconKey={presentation.iconKey} size={16} />
                            )}
                            <Text className="shared-view-page__name" title={item.name}>
                              {item.name}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {isFolder ? 'Folder' : presentation.label}
                          </Text>
                        </Table.Td>
                        <Table.Td>{formatFileSize(item.sizeBytes)}</Table.Td>
                        <Table.Td>{formatDate(item.updatedAt)}</Table.Td>
                        <Table.Td>
                          {isFolder ? (
                            <Button size="xs" variant="default" onClick={() => setFolderId(item.id)}>
                              Open
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="default"
                              leftSection={<IconDownload size={14} />}
                              loading={downloadingItemId === item.id}
                              onClick={() => void downloadItem(item)}
                            >
                              Download
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                  {!listQuery.isPending && (listQuery.data?.items.length ?? 0) === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="md">
                          This folder is empty.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : null}
                </Table.Tbody>
              </Table>
            )}
          </Box>
        </Stack>
      </Paper>
    </Box>
  )
}
