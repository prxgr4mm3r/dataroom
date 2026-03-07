import {
  IconArrowsMove,
  IconAlertTriangle,
  IconCopy,
  IconDownload,
  IconDotsVertical,
  IconFolder,
  IconLink,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import type { DragEvent } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { isFileItem } from '@/entities/content-item'
import type { DragImportOverlayState } from '@/features/drag-import-files'
import { formatDate, formatDateCompact } from '@/shared/lib/date/format-date'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/shared/lib/file/import-file-size-limit'
import { splitFileName } from '@/shared/lib/file/split-file-name'
import { ActionIcon, Box, FileTypeIcon, Group, Loader, Menu, ScrollArea, SelectionCheckbox, Table, Text } from '@/shared/ui'
import type { SortBy, SortOrder } from '@/shared/types/common'
import './file-table.css'

type DropState = 'none' | 'valid' | 'warning' | 'invalid'

type FileTableProps = {
  items: ContentItem[]
  loading: boolean
  currentFolderId: string
  openedPreviewId: string | null
  selectedIds: string[]
  sortBy: SortBy
  sortOrder: SortOrder
  onToggleSort: (sortBy: SortBy) => void
  onToggleSelect: (itemId: string) => void
  onOpenFile: (itemId: string) => void
  onOpenFolder: (folderId: string) => void
  onDownloadItem: (item: ContentItem) => void
  onCopyItem: (item: ContentItem) => void
  onMoveItem: (item: ContentItem) => void
  onDeleteItem: (item: ContentItem) => void
  onShareItem: (item: ContentItem) => void
  onDragStartItem: (itemId: string, event: DragEvent<HTMLTableRowElement>) => void
  onDragEnd: () => void
  onFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave: (folderId: string) => void
  onFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => void
  getFolderDropState: (folderId: string) => DropState
  importOverlayState: DragImportOverlayState
  isDraggingItem: (itemId: string) => boolean
}

const formatDraggedFileCount = (count: number): string => {
  if (count <= 0) {
    return 'files'
  }

  if (count === 1) {
    return '1 file'
  }

  return `${count} files`
}

const SortableHeader = ({
  label,
  active,
  order,
  onClick,
  width,
  className,
}: {
  label: string
  active: boolean
  order: SortOrder
  onClick: () => void
  width?: number
  className?: string
}) => (
  <Table.Th
    className={['file-table__th', 'file-table__th--sortable', className].filter(Boolean).join(' ')}
    style={{ whiteSpace: 'nowrap' }}
    onClick={onClick}
    w={width}
  >
    <Group gap={4} wrap="nowrap">
      <Text size="sm" fw={600}>
        {label}
      </Text>
      {active ? <Text size="xs">{order === 'asc' ? '↑' : '↓'}</Text> : null}
    </Group>
  </Table.Th>
)

export const FileTable = ({
  items,
  loading,
  currentFolderId,
  openedPreviewId,
  selectedIds,
  sortBy,
  sortOrder,
  onToggleSort,
  onToggleSelect,
  onOpenFile,
  onOpenFolder,
  onDownloadItem,
  onCopyItem,
  onMoveItem,
  onDeleteItem,
  onShareItem,
  onDragStartItem,
  onDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  getFolderDropState,
  importOverlayState,
  isDraggingItem,
}: FileTableProps) => {
  const currentFolderDropState = getFolderDropState(currentFolderId)
  const compactUpdatedAt = Boolean(openedPreviewId)
  const sizeColumnWidth = compactUpdatedAt ? 112 : 98
  const isImportOverlayActive = importOverlayState.mode !== 'none'
  const draggedFileCountLabel =
    importOverlayState.mode === 'none' ? '' : formatDraggedFileCount(importOverlayState.fileCount)

  const renderImportOverlay = () => {
    if (importOverlayState.mode === 'none') {
      return null
    }

    if (importOverlayState.mode === 'uploading') {
      return (
        <div className="file-table__drop-overlay file-table__drop-overlay--uploading" aria-live="polite">
          <div className="file-table__drop-overlay-card">
            <span className="file-table__drop-overlay-icon">
              <Loader size={18} color="#2563eb" />
            </span>
            <div>
              <Text size="sm" fw={700}>
                Importing {draggedFileCountLabel}...
              </Text>
              <Text size="xs" c="dimmed">
                Please wait while files are being uploaded.
              </Text>
            </div>
          </div>
        </div>
      )
    }

    if (importOverlayState.mode === 'warning') {
      const importableLabel = formatDraggedFileCount(importOverlayState.acceptedCount)
      const rejectedLabel = formatDraggedFileCount(importOverlayState.rejectedCount)

      return (
        <div className="file-table__drop-overlay file-table__drop-overlay--warning" aria-live="polite">
          <div className="file-table__drop-overlay-card">
            <span className="file-table__drop-overlay-icon">
              <IconAlertTriangle size={18} stroke={2} />
            </span>
            <div>
              <Text size="sm" fw={700}>
                Some files cannot be imported.
              </Text>
              <Text size="xs" c="dimmed">
                {importableLabel} will be uploaded. {rejectedLabel} exceed the size limit.
              </Text>
            </div>
          </div>
        </div>
      )
    }

    if (importOverlayState.mode === 'too_large') {
      return (
        <div className="file-table__drop-overlay file-table__drop-overlay--too-large" aria-live="polite">
          <div className="file-table__drop-overlay-card">
            <span className="file-table__drop-overlay-icon">
              <IconAlertTriangle size={18} stroke={2} />
            </span>
            <div>
              <Text size="sm" fw={700}>
                All selected files are too large.
              </Text>
              <Text size="xs" c="dimmed">
                Maximum size per file: {formatFileSize(MAX_IMPORT_FILE_SIZE_BYTES)}.
              </Text>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="file-table__drop-overlay file-table__drop-overlay--ready" aria-live="polite">
        <div className="file-table__drop-overlay-card">
          <span className="file-table__drop-overlay-icon">
            <IconUpload size={18} stroke={2} />
          </span>
          <div>
            <Text size="sm" fw={700}>
              Drop to import {draggedFileCountLabel}.
            </Text>
            <Text size="xs" c="dimmed">
              Files will be uploaded to this folder.
            </Text>
          </div>
        </div>
      </div>
    )
  }

  const handleRootDragLeave = (event: DragEvent<HTMLElement>) => {
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }
    onFolderDragLeave(currentFolderId)
  }

  if (loading) {
    return (
      <Text c="dimmed" p="md">
        Loading...
      </Text>
    )
  }

  if (!items.length) {
    let emptyBackground: string | undefined
    if (!isImportOverlayActive) {
      if (currentFolderDropState === 'valid') {
        emptyBackground = '#eaf7ed'
      } else if (currentFolderDropState === 'invalid') {
        emptyBackground = '#fff1f1'
      }
    }

    return (
      <Box
        className="file-table__container"
        p="md"
        bg={emptyBackground}
        style={{ minHeight: 120 }}
        onDragOver={(event) => onFolderDragOver(currentFolderId, event)}
        onDrop={(event) => onFolderDrop(currentFolderId, event)}
        onDragLeave={handleRootDragLeave}
      >
        <Text c="dimmed">This folder is empty.</Text>
        {renderImportOverlay()}
      </Box>
    )
  }

  let tableBodyBackground: string | undefined
  if (!isImportOverlayActive) {
    if (currentFolderDropState === 'valid') {
      tableBodyBackground = '#f3fbf5'
    } else if (currentFolderDropState === 'invalid') {
      tableBodyBackground = '#fff5f5'
    }
  }

  return (
    <Box
      className="file-table__container"
      h="100%"
      onDragOver={(event) => onFolderDragOver(currentFolderId, event)}
      onDrop={(event) => onFolderDrop(currentFolderId, event)}
      onDragLeave={handleRootDragLeave}
    >
      <ScrollArea h="100%">
        <Table className="file-table" stickyHeader highlightOnHover withColumnBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="file-table__th file-table__th--select" w={44} />
              <SortableHeader
                label="Name"
                active={sortBy === 'name'}
                order={sortOrder}
                onClick={() => onToggleSort('name')}
              />
              <SortableHeader
                label="Type"
                active={sortBy === 'type'}
                order={sortOrder}
                onClick={() => onToggleSort('type')}
              />
              <SortableHeader
                label="Size"
                active={sortBy === 'size'}
                order={sortOrder}
                onClick={() => onToggleSort('size')}
                width={sizeColumnWidth}
                className="file-table__th--size"
              />
              <Table.Th
                className="file-table__th file-table__th--updated"
                style={{ whiteSpace: 'nowrap' }}
                w={compactUpdatedAt ? 122 : undefined}
              >
                {compactUpdatedAt ? 'Updated' : 'Updated at'}
              </Table.Th>
              <Table.Th className="file-table__th file-table__th--actions" w={56} />
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody bg={tableBodyBackground}>
            {items.map((item) => {
              const isSelected = selectedIds.includes(item.id)
              const isOpened = openedPreviewId === item.id
              const isFolder = !isFileItem(item)
              const dropState = isFolder ? getFolderDropState(item.id) : 'none'
              const isDragging = isDraggingItem(item.id)
              const fileTypePresentation = isFileItem(item)
                ? getFileTypePresentation(item.name, item.mimeType)
                : null
              const nameParts = isFileItem(item)
                ? splitFileName(item.name)
                : {
                    base: item.name,
                    extension: '',
                  }

              let rowBackground: string | undefined
              if (dropState === 'valid') {
                rowBackground = '#eaf7ed'
              } else if (dropState === 'warning') {
                rowBackground = '#fff8db'
              } else if (dropState === 'invalid') {
                rowBackground = '#fff1f1'
              } else if (isOpened) {
                rowBackground = '#eef2ff'
              }

              return (
                <Table.Tr
                  key={item.id}
                  className="file-table__row"
                  bg={rowBackground}
                  draggable
                  onDragStart={(event) => onDragStartItem(item.id, event)}
                  onDragEnd={onDragEnd}
                  onDragOver={
                    isFolder
                      ? (event) => {
                          event.stopPropagation()
                          onFolderDragOver(item.id, event)
                        }
                      : undefined
                  }
                  onDragLeave={
                    isFolder
                      ? (event) => {
                          event.stopPropagation()
                          onFolderDragLeave(item.id)
                        }
                      : undefined
                  }
                  onDrop={
                    isFolder
                      ? (event) => {
                          event.stopPropagation()
                          onFolderDrop(item.id, event)
                        }
                      : undefined
                  }
                  style={{ opacity: isDragging ? 0.45 : 1 }}
                >
                  <Table.Td className="file-table__td file-table__td--select">
                    <span className="file-table__select-control">
                      <SelectionCheckbox
                        checked={isSelected}
                        ariaLabel={`Select ${item.name}`}
                        onCheckedChange={() => onToggleSelect(item.id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </span>
                  </Table.Td>

                  <Table.Td
                    className="file-table__td file-table__td--name"
                    onClick={() => (isFileItem(item) ? onOpenFile(item.id) : onOpenFolder(item.id))}
                  >
                    <Group gap={8} wrap="nowrap">
                      <span className="file-table__item-icon" aria-hidden="true">
                        {isFileItem(item) ? (
                          <FileTypeIcon iconKey={fileTypePresentation?.iconKey ?? 'default'} size={16} />
                        ) : (
                          <IconFolder size={16} color="#2f6fed" />
                        )}
                      </span>
                      <Text size="sm" fw={item.kind === 'folder' ? 600 : 500} className="file-table__name-text" title={item.name}>
                        <span className="file-table__name-base">{nameParts.base}</span>
                        {nameParts.extension ? <span className="file-table__name-ext">{nameParts.extension}</span> : null}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td className="file-table__td">{item.kind === 'folder' ? 'Folder' : fileTypePresentation?.label}</Table.Td>
                  <Table.Td className="file-table__td file-table__td--size">{formatFileSize(item.sizeBytes)}</Table.Td>
                  <Table.Td
                    className={[
                      'file-table__td',
                      'file-table__td--updated',
                      compactUpdatedAt ? 'file-table__td--updated-compact' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={compactUpdatedAt ? formatDate(item.updatedAt) : undefined}
                  >
                    {compactUpdatedAt ? formatDateCompact(item.updatedAt) : formatDate(item.updatedAt)}
                  </Table.Td>
                  <Table.Td className="file-table__td file-table__td--actions">
                    <Menu withinPortal position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${item.name}`}>
                          <IconDotsVertical size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => onDownloadItem(item)}>
                          Download
                        </Menu.Item>
                        <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => onCopyItem(item)}>
                          Copy
                        </Menu.Item>
                        <Menu.Item leftSection={<IconLink size={14} />} onClick={() => onShareItem(item)}>
                          Share
                        </Menu.Item>
                        <Menu.Item leftSection={<IconArrowsMove size={14} />} onClick={() => onMoveItem(item)}>
                          Move
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => onDeleteItem(item)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {renderImportOverlay()}
    </Box>
  )
}
