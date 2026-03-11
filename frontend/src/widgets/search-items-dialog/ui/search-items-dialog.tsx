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

type FileTypeFilter = 'any' | 'folders' | 'documents' | 'images' | 'media' | 'archives' | 'code' | 'data' | 'other'
type SearchScope = 'all' | 'current'

type EnrichedItem = {
  raw: ContentItem
  fileType: FileTypePresentation | null
  fileTypeFilter: FileTypeFilter
}

const fileTypeOptions: Array<{ value: FileTypeFilter; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'folders', label: 'Folders' },
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

  const canSearch = opened && (mode === 'dataroom' || Boolean(shareToken))
  const useServerScopedCurrentFolderSearch = mode === 'dataroom' && searchScope === 'current' && currentFolderId !== 'root'

  const searchQuery = useQuery({
    queryKey: [
      'global-search-items',
      mode,
      shareToken ?? '',
      debouncedQuery,
      searchScope,
      useServerScopedCurrentFolderSearch ? currentFolderId : 'root',
    ],
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
        rootItemId: useServerScopedCurrentFolderSearch ? currentFolderId : undefined,
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
    if (searchScope === 'all' || currentFolderId === 'root' || useServerScopedCurrentFolderSearch) {
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
  }, [currentFolderDescendantIds, currentFolderId, enrichedItems, searchScope, useServerScopedCurrentFolderSearch])

  const filteredItems = useMemo(
    () =>
      filteredByScopeItems.filter((item) => {
        if (selectedFileType === 'any') {
          return true
        }

        if (selectedFileType === 'folders') {
          return item.raw.kind === 'folder'
        }

        if (item.raw.kind !== 'file') {
          return false
        }

        return item.fileTypeFilter === selectedFileType
      }),
    [filteredByScopeItems, selectedFileType],
  )

  const showScopeWarning =
    !useServerScopedCurrentFolderSearch &&
    searchScope === 'current' &&
    !canApplyCurrentScope &&
    !folderTreePending &&
    !folderTreeError

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
      styles={{
        header: {
          padding: '10px',
          minHeight: 0,
        },
        title: {
          fontSize: '0.95rem',
          lineHeight: 1.2,
        },
        close: {
          width: 28,
          height: 28,
        },
        body: {
          padding: '18px 16px 16px',
        },
      }}
    >
      <Box className="flex flex-col gap-3">
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
        <div className="flex w-full items-center gap-2 max-[760px]:flex-col max-[760px]:items-stretch">
          <div
            className="relative inline-flex flex-1 items-center overflow-hidden rounded-[10px] border border-[var(--table-separator)] bg-[var(--bg-subtle)] p-[3px]"
            role="group"
            aria-label="Search scope"
            data-scope={searchScope}
          >
            <span
              className={[
                'pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc((100%-6px)/2)] rounded-[7px] bg-[var(--accent-soft)] transition-transform duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                searchScope === 'all' ? 'translate-x-full' : 'translate-x-0',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-hidden="true"
            />
            <button
              type="button"
              className={[
                'relative z-[1] flex-1 rounded-[7px] border-0 bg-transparent px-2.5 py-1.5 text-[9px] font-semibold text-[var(--text-secondary)] transition-colors duration-[120ms] ease-[ease] hover:text-[var(--text-primary)]',
                searchScope === 'current' ? 'text-[var(--accent)]' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ fontSize: '14px', lineHeight: 1.15 }}
              onClick={() => setSearchScope('current')}
            >
              Current folder
            </button>
            <button
              type="button"
              className={[
                'relative z-[1] flex-1 rounded-[7px] border-0 bg-transparent px-2.5 py-1.5 text-[9px] font-semibold text-[var(--text-secondary)] transition-colors duration-[120ms] ease-[ease] hover:text-[var(--text-primary)]',
                searchScope === 'all' ? 'text-[var(--accent)]' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ fontSize: '14px', lineHeight: 1.15 }}
              onClick={() => setSearchScope('all')}
            >
              All folders
            </button>
          </div>
          <Menu shadow="md" width={220} position="bottom-start" offset={6}>
            <Menu.Target>
              <button
                type="button"
                className="flex w-[220px] min-w-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-[var(--table-separator)] bg-[var(--bg-subtle)] px-2.5 py-2 text-left text-[var(--text-primary)] transition-[border-color,background-color] duration-[120ms] ease-[ease] hover:border-[var(--accent)] hover:bg-[var(--table-row-hover-bg)] max-[760px]:w-full"
              >
                <Text size="xs" c="dimmed">
                  Type:
                </Text>
                <Text size="sm" fw={600} className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {selectedFileTypeLabel}
                </Text>
                <IconChevronDown size={14} className="shrink-0 text-[var(--text-secondary)]" />
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
          className="min-h-[220px] max-h-[420px] w-[calc(100%+10px)] -mr-[10px]"
        >
          {showScopeWarning ? (
            <Text size="xs" c="orange" className="px-0.5 pt-2 pb-0.5">
              Current folder tree is unavailable. Showing direct folder matches only.
            </Text>
          ) : null}
          {searchQuery.isPending ? (
            <Box className="flex min-h-[180px] items-center justify-center">
              <Loader size="sm" />
            </Box>
          ) : null}
          {!searchQuery.isPending && searchQuery.error ? (
            <Text size="sm" c="red" className="flex min-h-[180px] items-center justify-center px-3 text-center">
              {toApiError(searchQuery.error).message}
            </Text>
          ) : null}
          {!searchQuery.isPending && !searchQuery.error && filteredItems.length === 0 ? (
            <Text size="sm" c="dimmed" className="flex min-h-[180px] items-center justify-center px-3 text-center">
              {items.length > 0 ? 'No items match current filters.' : 'No items found.'}
            </Text>
          ) : null}
          {!searchQuery.isPending && !searchQuery.error && filteredItems.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {filteredItems.map(({ raw: item, fileType }) => {
                const subtitle = item.kind === 'folder' ? 'Folder' : fileType?.label ?? 'File'

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-[var(--table-separator)] bg-[var(--bg-subtle)] px-3 py-2.5 text-left text-inherit transition-[border-color,background-color] duration-[120ms] ease-[ease] hover:border-[var(--accent)] hover:bg-[var(--table-row-hover-bg)]"
                    onClick={() => openItem(item)}
                  >
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                      {item.kind === 'folder' ? (
                        <IconFolder size={16} color="var(--accent)" />
                      ) : (
                        <FileTypeIcon iconKey={fileType?.iconKey ?? 'default'} size={16} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
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
