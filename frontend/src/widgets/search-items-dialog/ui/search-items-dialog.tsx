import { IconCheck, IconChevronDown, IconFolder, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { type FolderNode, mapFolderTreeDto } from '@/entities/folder'
import type { ContentItem } from '@/entities/content-item'
import { useFolderTreeQuery } from '@/features/load-folder-tree'
import { searchContentItems, searchSharedContentItems } from '@/features/search-content-items'
import { apiClient, toApiError } from '@/shared/api'
import type { FileTypeIconKey, FileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { formatDateCompact } from '@/shared/lib/date/format-date'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import type { FolderTreeDto } from '@/shared/api'
import { Box, FileTypeIcon, Loader, Menu, Modal, ScrollArea, Text, TextInput } from '@/shared/ui'
import './search-items-dialog.css'

type SearchItemsDialogProps = {
  opened: boolean
  mode: 'dataroom' | 'shared'
  shareToken?: string
  currentFolderId: string
  onClose: () => void
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string | null) => void
}

const SEARCH_DEBOUNCE_MS = 280
const SEARCH_RESULT_LIMIT = 100
const RESULTS_SCROLLBAR_SIZE = 10

type FileTypeFilter = 'any' | 'documents' | 'images' | 'media' | 'archives' | 'code' | 'data' | 'other'
type SearchScope = 'all' | 'current'

type EnrichedItem = {
  raw: ContentItem
  fileType: FileTypePresentation | null
  fileTypeFilter: FileTypeFilter
}

const fileTypeOptions: Array<{ value: FileTypeFilter; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'documents', label: 'Documents' },
  { value: 'images', label: 'Images' },
  { value: 'media', label: 'Media' },
  { value: 'archives', label: 'Archives' },
  { value: 'code', label: 'Code' },
  { value: 'data', label: 'Data' },
  { value: 'other', label: 'Other' },
]

const resolveFileTypeFilter = (iconKey: FileTypeIconKey): FileTypeFilter => {
  if (['pdf', 'word', 'excel', 'csv', 'powerpoint', 'text', 'markdown'].includes(iconKey)) {
    return 'documents'
  }
  if (iconKey === 'image') {
    return 'images'
  }
  if (iconKey === 'video' || iconKey === 'audio') {
    return 'media'
  }
  if (iconKey === 'archive') {
    return 'archives'
  }
  if (iconKey === 'code') {
    return 'code'
  }
  if (['json', 'xml', 'yaml', 'sql'].includes(iconKey)) {
    return 'data'
  }
  return 'other'
}

const findFolderNodeById = (tree: FolderNode | undefined, folderId: string): FolderNode | null => {
  if (!tree) {
    return null
  }
  if (tree.id === folderId) {
    return tree
  }
  for (const child of tree.children) {
    const found = findFolderNodeById(child, folderId)
    if (found) {
      return found
    }
  }
  return null
}

export const SearchItemsDialog = ({
  opened,
  mode,
  shareToken,
  currentFolderId,
  onClose,
  onOpenFolder,
  onOpenFile,
}: SearchItemsDialogProps) => {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('all')
  const [selectedFileType, setSelectedFileType] = useState<FileTypeFilter>('any')

  const dataroomFolderTreeQuery = useFolderTreeQuery(opened && mode === 'dataroom')
  const sharedFolderTreeQuery = useQuery({
    queryKey: ['shared-folder-tree', shareToken ?? ''],
    queryFn: async () => {
      const response = await apiClient.get<FolderTreeDto>(
        `/api/public/shares/${encodeURIComponent(String(shareToken))}/folders/tree`,
      )
      return mapFolderTreeDto(response.data)
    },
    enabled: opened && mode === 'shared' && Boolean(shareToken),
    staleTime: 30_000,
  })

  const folderTree = mode === 'shared' ? sharedFolderTreeQuery.data : dataroomFolderTreeQuery.data
  const folderTreeError = mode === 'shared' ? sharedFolderTreeQuery.error : dataroomFolderTreeQuery.error
  const folderTreePending = mode === 'shared' ? sharedFolderTreeQuery.isPending : dataroomFolderTreeQuery.isPending

  useEffect(() => {
    if (!opened) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [opened, query])

  const canSearch = opened && debouncedQuery.length > 0 && (mode === 'dataroom' || Boolean(shareToken))

  const searchQuery = useQuery({
    queryKey: ['global-search-items', mode, shareToken ?? '', debouncedQuery],
    queryFn: async () => {
      if (mode === 'shared') {
        return searchSharedContentItems({
          shareToken: String(shareToken),
          query: debouncedQuery,
          limit: SEARCH_RESULT_LIMIT,
        })
      }
      return searchContentItems({
        query: debouncedQuery,
        limit: SEARCH_RESULT_LIMIT,
      })
    },
    enabled: canSearch,
    staleTime: 30_000,
  })

  const items = useMemo(() => searchQuery.data ?? [], [searchQuery.data])

  const selectedFileTypeLabel = useMemo(
    () => fileTypeOptions.find((option) => option.value === selectedFileType)?.label ?? 'Any',
    [selectedFileType],
  )

  const enrichedItems = useMemo<EnrichedItem[]>(
    () =>
      items.map((item) => {
        if (item.kind === 'folder') {
          return {
            raw: item,
            fileType: null,
            fileTypeFilter: 'any',
          }
        }

        const fileType = getFileTypePresentation(item.name, item.mimeType)
        return {
          raw: item,
          fileType,
          fileTypeFilter: resolveFileTypeFilter(fileType.iconKey),
        }
      }),
    [items],
  )

  const currentFolderDescendantIds = useMemo(() => {
    if (currentFolderId === 'root') {
      return new Set<string>()
    }

    const currentNode = findFolderNodeById(folderTree, currentFolderId)
    if (!currentNode) {
      return null
    }

    const descendants = new Set<string>()
    const visit = (node: FolderNode) => {
      node.children.forEach((child) => {
        descendants.add(child.id)
        visit(child)
      })
    }

    visit(currentNode)
    return descendants
  }, [currentFolderId, folderTree])

  const canApplyCurrentScope = searchScope === 'all' || currentFolderId === 'root' || Boolean(currentFolderDescendantIds)

  const filteredByScopeItems = useMemo(() => {
    if (searchScope === 'all' || currentFolderId === 'root') {
      return enrichedItems
    }

    if (!currentFolderDescendantIds) {
      return enrichedItems.filter((item) =>
        item.raw.kind === 'folder' ? item.raw.id === currentFolderId : item.raw.parentId === currentFolderId,
      )
    }

    return enrichedItems.filter((item) => {
      if (item.raw.kind === 'folder') {
        return item.raw.id === currentFolderId || currentFolderDescendantIds.has(item.raw.id)
      }
      const parentId = item.raw.parentId
      return parentId === currentFolderId || (parentId ? currentFolderDescendantIds.has(parentId) : false)
    })
  }, [currentFolderDescendantIds, currentFolderId, enrichedItems, searchScope])

  const filteredItems = useMemo(
    () =>
      filteredByScopeItems.filter((item) => {
        if (selectedFileType === 'any') {
          return true
        }

        if (item.raw.kind !== 'file') {
          return false
        }

        return item.fileTypeFilter === selectedFileType
      }),
    [filteredByScopeItems, selectedFileType],
  )

  const showScopeWarning = searchScope === 'current' && !canApplyCurrentScope && !folderTreePending && !folderTreeError
  const hasQuery = query.trim().length > 0

  const handleClose = () => {
    setQuery('')
    setDebouncedQuery('')
    setSearchScope('all')
    setSelectedFileType('any')
    onClose()
  }

  const openItem = (item: ContentItem) => {
    if (item.kind === 'folder') {
      onOpenFolder(item.id)
    } else {
      onOpenFile(item.id, item.parentId)
    }
    handleClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      centered
      title="Search files and folders"
      size="lg"
      classNames={{
        body: 'search-items-dialog__body',
      }}
    >
      <Box className="search-items-dialog">
        <TextInput
          data-autofocus
          value={query}
          onChange={(event) => {
            const nextQuery = event.currentTarget.value
            setQuery(nextQuery)
            if (!nextQuery.trim()) {
              setDebouncedQuery('')
            }
          }}
          placeholder="Type a name to search across all folders"
          leftSection={<IconSearch size={16} />}
        />
        <div className="search-items-dialog__filters">
          <div className="search-items-dialog__scope-toggle" role="group" aria-label="Search scope" data-scope={searchScope}>
            <span className="search-items-dialog__scope-indicator" aria-hidden="true" />
            <button
              type="button"
              className={[
                'search-items-dialog__scope-option',
                searchScope === 'current' ? 'search-items-dialog__scope-option--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSearchScope('current')}
            >
              Current folder
            </button>
            <button
              type="button"
              className={[
                'search-items-dialog__scope-option',
                searchScope === 'all' ? 'search-items-dialog__scope-option--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSearchScope('all')}
            >
              All folders
            </button>
          </div>
          <Menu shadow="md" width={220} position="bottom-start" offset={6}>
            <Menu.Target>
              <button type="button" className="search-items-dialog__filter-trigger search-items-dialog__filter-trigger--type">
                <Text size="xs" c="dimmed">
                  Type:
                </Text>
                <Text size="sm" fw={600} className="search-items-dialog__filter-value">
                  {selectedFileTypeLabel}
                </Text>
                <IconChevronDown size={14} className="search-items-dialog__filter-chevron" />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              {fileTypeOptions.map((option) => (
                <Menu.Item
                  key={option.value}
                  leftSection={selectedFileType === option.value ? <IconCheck size={14} /> : null}
                  onClick={() => setSelectedFileType(option.value)}
                >
                  {option.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </div>
        <ScrollArea
          h={420}
          type="always"
          offsetScrollbars
          scrollbarSize={RESULTS_SCROLLBAR_SIZE}
          className="search-items-dialog__results"
        >
          {showScopeWarning ? (
            <Text size="xs" c="orange" className="search-items-dialog__scope-warning">
              Current folder tree is unavailable. Showing direct folder matches only.
            </Text>
          ) : null}
          {!hasQuery ? (
            <Text size="sm" c="dimmed" className="search-items-dialog__empty">
              Start typing to search by name across all files and folders.
            </Text>
          ) : null}
          {hasQuery && searchQuery.isPending ? (
            <Box className="search-items-dialog__loading">
              <Loader size="sm" />
            </Box>
          ) : null}
          {hasQuery && searchQuery.error ? (
            <Text size="sm" c="red" className="search-items-dialog__empty">
              {toApiError(searchQuery.error).message}
            </Text>
          ) : null}
          {hasQuery && !searchQuery.isPending && !searchQuery.error && filteredItems.length === 0 ? (
            <Text size="sm" c="dimmed" className="search-items-dialog__empty">
              {items.length > 0 ? 'No items match current filters.' : 'No items found.'}
            </Text>
          ) : null}
          {hasQuery && !searchQuery.isPending && !searchQuery.error && filteredItems.length > 0 ? (
            <div className="search-items-dialog__list">
              {filteredItems.map(({ raw: item, fileType }) => {
                const subtitle = item.kind === 'folder' ? 'Folder' : fileType?.label ?? 'File'

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="search-items-dialog__item"
                    onClick={() => openItem(item)}
                  >
                    <span className="search-items-dialog__item-icon" aria-hidden="true">
                      {item.kind === 'folder' ? (
                        <IconFolder size={16} color="var(--accent)" />
                      ) : (
                        <FileTypeIcon iconKey={fileType?.iconKey ?? 'default'} size={16} />
                      )}
                    </span>
                    <span className="search-items-dialog__item-content">
                      <Text size="sm" fw={600} truncate>
                        {item.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {subtitle} · Updated {formatDateCompact(item.updatedAt)}
                      </Text>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </ScrollArea>
      </Box>
    </Modal>
  )
}
