import { IconFolder, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { searchContentItems, searchSharedContentItems } from '@/features/search-content-items'
import { formatDateCompact } from '@/shared/lib/date/format-date'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { Box, FileTypeIcon, Loader, Modal, ScrollArea, Text, TextInput } from '@/shared/ui'
import { toApiError } from '@/shared/api'
import './search-items-dialog.css'

type SearchItemsDialogProps = {
  opened: boolean
  mode: 'dataroom' | 'shared'
  shareToken?: string
  onClose: () => void
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string | null) => void
}

const SEARCH_DEBOUNCE_MS = 280
const SEARCH_RESULT_LIMIT = 50

export const SearchItemsDialog = ({
  opened,
  mode,
  shareToken,
  onClose,
  onOpenFolder,
  onOpenFile,
}: SearchItemsDialogProps) => {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

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

  const handleClose = () => {
    setQuery('')
    setDebouncedQuery('')
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
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Type a name to search across all folders"
          leftSection={<IconSearch size={16} />}
        />
        <ScrollArea h={420} type="always" offsetScrollbars className="search-items-dialog__results">
          {!query.trim() ? (
            <Text size="sm" c="dimmed" className="search-items-dialog__empty">
              Start typing to search by name across all files and folders.
            </Text>
          ) : null}
          {query.trim() && searchQuery.isPending ? (
            <Box className="search-items-dialog__loading">
              <Loader size="sm" />
            </Box>
          ) : null}
          {query.trim() && searchQuery.error ? (
            <Text size="sm" c="red" className="search-items-dialog__empty">
              {toApiError(searchQuery.error).message}
            </Text>
          ) : null}
          {query.trim() && !searchQuery.isPending && !searchQuery.error && items.length === 0 ? (
            <Text size="sm" c="dimmed" className="search-items-dialog__empty">
              No items found.
            </Text>
          ) : null}
          {!searchQuery.isPending && !searchQuery.error && items.length > 0 ? (
            <div className="search-items-dialog__list">
              {items.map((item) => {
                const fileType = item.kind === 'file' ? getFileTypePresentation(item.name, item.mimeType) : null
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
