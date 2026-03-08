import { IconAlertTriangle, IconSearch } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'

import { mapItemResourceDto, type ContentItem } from '@/entities/content-item'
import { apiClient, toApiError } from '@/shared/api'
import type { ItemResourceDto, ListItemsDto } from '@/shared/api'
import { routes } from '@/shared/config/routes'
import { downloadBlob } from '@/shared/lib/file/download-blob'
import { getSelectionRangeIds } from '@/features/select-content-items'
import { useSortState } from '@/features/sort-content-items'
import type { SortBy, SortOrder } from '@/shared/types/common'
import { ActionIcon, Alert, Box, Center, Group, Loader, Paper, Stack, Text, Title, Tooltip } from '@/shared/ui'
import { notifyError } from '@/shared/ui'
import { BreadcrumbsBar } from '@/widgets/breadcrumbs-bar'
import { FileTable } from '@/widgets/file-table'
import { SearchItemsDialog } from '@/widgets/search-items-dialog'
import { SharedPreviewPane } from '@/widgets/shared-preview-pane'

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
const DOWNLOAD_FALLBACK_NAME = 'shared-download.zip'
const ZIP_EXTENSION_PATTERN = /\.zip$/i

const parseFilename = (headerValue: unknown): string | null => {
  if (!headerValue || typeof headerValue !== 'string') {
    return null
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ''))
    } catch {
      return utf8Match[1].replace(/^"|"$/g, '')
    }
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] ?? null
}

const resolveFallbackDownloadName = (itemIds: string[], items: ContentItem[]): string => {
  if (itemIds.length !== 1) {
    return DOWNLOAD_FALLBACK_NAME
  }

  const selectedItem = items.find((item) => item.id === itemIds[0])
  if (!selectedItem) {
    return DOWNLOAD_FALLBACK_NAME
  }

  if (selectedItem.kind === 'folder') {
    return ZIP_EXTENSION_PATTERN.test(selectedItem.name) ? selectedItem.name : `${selectedItem.name}.zip`
  }

  return selectedItem.name || DOWNLOAD_FALLBACK_NAME
}

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
  const [searchParams, setSearchParams] = useSearchParams()
  const folderId = searchParams.get('folder') || 'root'
  const previewItemId = searchParams.get('preview')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectionAnchorIdRef = useRef<string | null>(null)
  const [searchDialogOpened, setSearchDialogOpened] = useState(false)
  const [downloadPending, setDownloadPending] = useState(false)
  const { sortBy, sortOrder, toggleSort } = useSortState()

  useEffect(() => {
    setSelectedIds([])
    selectionAnchorIdRef.current = null
  }, [shareToken])

  useEffect(() => {
    setSelectedIds([])
    selectionAnchorIdRef.current = null
  }, [folderId])

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
    placeholderData: keepPreviousData,
  })

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items])
  const orderedItemIds = useMemo(() => items.map((item) => item.id), [items])
  const breadcrumbs = useMemo(
    () => listQuery.data?.breadcrumbs.map((crumb) => ({ id: crumb.id, name: crumb.name })) ?? [],
    [listQuery.data?.breadcrumbs],
  )

  useEffect(() => {
    if (!previewItemId) {
      return
    }

    const itemStillVisible = items.some((item) => item.id === previewItemId)
    if (!itemStillVisible) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('preview')
      setSearchParams(nextParams, { replace: true })
    }
  }, [items, previewItemId, searchParams, setSearchParams])

  useEffect(() => {
    if (!selectedIds.length) {
      return
    }
    const availableIds = new Set(items.map((item) => item.id))
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)))
  }, [items, selectedIds.length])

  const toggleSelected = (itemId: string) => {
    setSelectedIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]))
    selectionAnchorIdRef.current = itemId
  }

  const toggleSelectedWithOptions = (itemId: string, options?: { range?: boolean; keepExisting?: boolean }) => {
    if (options?.range) {
      const rangeIds = getSelectionRangeIds(orderedItemIds, selectionAnchorIdRef.current, itemId)
      if (rangeIds.length) {
        setSelectedIds((current) => (options.keepExisting ? [...new Set([...current, ...rangeIds])] : rangeIds))
      }
      return
    }
    toggleSelected(itemId)
  }

  const clearSelection = () => {
    setSelectedIds([])
    selectionAnchorIdRef.current = null
  }

  const setSharedLocation = (nextFolderId: string, nextPreviewItemId: string | null) => {
    const nextParams = new URLSearchParams(searchParams)
    const normalizedFolderId = nextFolderId || 'root'

    if (normalizedFolderId === 'root') {
      nextParams.delete('folder')
    } else {
      nextParams.set('folder', normalizedFolderId)
    }

    if (nextPreviewItemId) {
      nextParams.set('preview', nextPreviewItemId)
    } else {
      nextParams.delete('preview')
    }

    setSearchParams(nextParams)
  }

  const openSharedFolder = (targetFolderId: string) => {
    setSharedLocation(targetFolderId, null)
  }

  const openSharedPreview = (fileId: string) => {
    setSharedLocation(folderId, fileId)
  }

  const closeSharedPreview = () => {
    setSharedLocation(folderId, null)
  }

  const openSharedSearchFolder = (targetFolderId: string) => {
    openSharedFolder(targetFolderId || 'root')
  }

  const openSharedSearchFile = (fileId: string, parentFolderId: string | null) => {
    setSharedLocation(parentFolderId ?? 'root', fileId)
  }

  const downloadItems = async (itemIds: string[]) => {
    if (!itemIds.length) {
      return
    }

    setDownloadPending(true)
    try {
      const response = await apiClient.post<Blob>(
        `/api/public/shares/${encodeURIComponent(String(shareToken))}/download`,
        { item_ids: itemIds },
        { responseType: 'blob' },
      )

      const fallbackName = resolveFallbackDownloadName(itemIds, items)
      const filename = parseFilename(response.headers['content-disposition']) ?? fallbackName
      downloadBlob(response.data, filename)
    } catch (error) {
      notifyError(toApiError(error).message)
    } finally {
      setDownloadPending(false)
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
      <Center mih="100vh" className="shared-view-page__error-wrap">
        <Paper className="shared-view-page__error-card" withBorder>
          <Stack gap="sm">
            <Group gap={8}>
              <IconAlertTriangle size={18} color="var(--state-danger-icon)" />
              <Title order={3}>Shared link unavailable</Title>
            </Group>
            <Text size="sm" c="dimmed">
              This link is invalid, expired, or no longer available.
            </Text>
            <Alert color="red">{toApiError(metaQuery.error).message}</Alert>
          </Stack>
        </Paper>
      </Center>
    )
  }

  return (
    <Box className="shared-view-page">
      <header className="shared-view-page__header">
        <Group justify="space-between" align="center" wrap="nowrap" gap="md">
          <Box className="shared-view-page__breadcrumbs">
            <BreadcrumbsBar breadcrumbs={breadcrumbs} onNavigate={openSharedFolder} compact />
          </Box>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="Search files and folders">
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                aria-label="Search files and folders"
                onClick={() => setSearchDialogOpened(true)}
              >
                <IconSearch size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </header>

      <main className="shared-view-page__body">
        <div className="shared-view-page__content">
          <Box className="shared-view-page__table">
            {listQuery.error ? (
              <Alert color="red" m="md" title="Failed to load items">
                {toApiError(listQuery.error).message}
              </Alert>
            ) : (
              <FileTable
                readOnly
                items={items}
                loading={listQuery.isPending && !listQuery.data}
                currentFolderId={folderId}
                openedPreviewId={previewItemId}
                selectedIds={selectedIds}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onToggleSort={toggleSort}
                onToggleSelect={toggleSelectedWithOptions}
                onToggleSelectAll={(checked) => {
                  const nextIds = checked ? items.map((item) => item.id) : []
                  setSelectedIds(nextIds)
                  selectionAnchorIdRef.current = nextIds[0] ?? null
                }}
                onOpenFile={openSharedPreview}
                onOpenFolder={openSharedFolder}
                onClearSelection={clearSelection}
                onDownloadSelected={() => {
                  void downloadItems(selectedIds)
                }}
                downloadPending={downloadPending}
                onDownloadItem={(item) => {
                  void downloadItems([item.id])
                }}
              />
            )}
          </Box>
          <SharedPreviewPane
            shareToken={String(shareToken)}
            previewItemId={previewItemId}
            onClose={closeSharedPreview}
          />
        </div>
      </main>

      <SearchItemsDialog
        opened={searchDialogOpened}
        mode="shared"
        shareToken={String(shareToken)}
        currentFolderId={folderId}
        onClose={() => setSearchDialogOpened(false)}
        onOpenFolder={openSharedSearchFolder}
        onOpenFile={openSharedSearchFile}
      />
    </Box>
  )
}
