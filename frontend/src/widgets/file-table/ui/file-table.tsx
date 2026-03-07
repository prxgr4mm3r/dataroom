import {
  IconArrowsMove,
  IconCopy,
  IconDotsVertical,
  IconFile,
  IconFolder,
  IconTrash,
} from '@tabler/icons-react'
import type { DragEvent } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { isFileItem } from '@/entities/content-item'
import { formatDate } from '@/shared/lib/date/format-date'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { ActionIcon, Box, Checkbox, Group, Menu, ScrollArea, Table, Text } from '@/shared/ui'
import type { SortBy, SortOrder } from '@/shared/types/common'
import './file-table.css'

type DropState = 'none' | 'valid' | 'invalid'

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
  onCopyItem: (item: ContentItem) => void
  onMoveItem: (item: ContentItem) => void
  onDeleteItem: (item: ContentItem) => void
  onDragStartItem: (itemId: string, event: DragEvent<HTMLTableRowElement>) => void
  onDragEnd: () => void
  onFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave: (folderId: string) => void
  onFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => void
  getFolderDropState: (folderId: string) => DropState
  isDraggingItem: (itemId: string) => boolean
}

const SortableHeader = ({
  label,
  active,
  order,
  onClick,
}: {
  label: string
  active: boolean
  order: SortOrder
  onClick: () => void
}) => (
  <Table.Th className="file-table__th file-table__th--sortable" style={{ whiteSpace: 'nowrap' }} onClick={onClick}>
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
  onCopyItem,
  onMoveItem,
  onDeleteItem,
  onDragStartItem,
  onDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  getFolderDropState,
  isDraggingItem,
}: FileTableProps) => {
  const currentFolderDropState = getFolderDropState(currentFolderId)

  if (loading) {
    return (
      <Text c="dimmed" p="md">
        Loading...
      </Text>
    )
  }

  if (!items.length) {
    let emptyBackground: string | undefined
    if (currentFolderDropState === 'valid') {
      emptyBackground = '#eaf7ed'
    } else if (currentFolderDropState === 'invalid') {
      emptyBackground = '#fff1f1'
    }

    return (
      <Box
        p="md"
        bg={emptyBackground}
        style={{ minHeight: 120 }}
        onDragOver={(event) => onFolderDragOver(currentFolderId, event)}
        onDrop={(event) => onFolderDrop(currentFolderId, event)}
        onDragLeave={() => onFolderDragLeave(currentFolderId)}
      >
        <Text c="dimmed">This folder is empty.</Text>
      </Box>
    )
  }

  let tableBodyBackground: string | undefined
  if (currentFolderDropState === 'valid') {
    tableBodyBackground = '#f3fbf5'
  } else if (currentFolderDropState === 'invalid') {
    tableBodyBackground = '#fff5f5'
  }

  return (
    <ScrollArea
      h="100%"
      onDragOver={(event) => onFolderDragOver(currentFolderId, event)}
      onDrop={(event) => onFolderDrop(currentFolderId, event)}
      onDragLeave={() => onFolderDragLeave(currentFolderId)}
    >
      <Table className="file-table" stickyHeader highlightOnHover withColumnBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th className="file-table__th" w={44} />
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
            />
            <Table.Th className="file-table__th">Updated at</Table.Th>
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

            let rowBackground: string | undefined
            if (dropState === 'valid') {
              rowBackground = '#eaf7ed'
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
                <Table.Td className="file-table__td">
                  <Checkbox
                    checked={isSelected}
                    aria-label={`Select ${item.name}`}
                    onChange={() => onToggleSelect(item.id)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Table.Td>

                <Table.Td
                  className="file-table__td file-table__td--name"
                  onClick={() => (isFileItem(item) ? onOpenFile(item.id) : onOpenFolder(item.id))}
                >
                  <Group gap={8} wrap="nowrap">
                    {isFileItem(item) ? (
                      <IconFile size={16} color="#667085" />
                    ) : (
                      <IconFolder size={16} color="#2f6fed" />
                    )}
                    <Text size="sm" fw={item.kind === 'folder' ? 600 : 500}>
                      {item.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td className="file-table__td">{item.kind === 'folder' ? 'Folder' : item.mimeType || '-'}</Table.Td>
                <Table.Td className="file-table__td">{formatFileSize(item.sizeBytes)}</Table.Td>
                <Table.Td className="file-table__td">{formatDate(item.updatedAt)}</Table.Td>
                <Table.Td className="file-table__td file-table__td--actions">
                  <Menu withinPortal position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${item.name}`}>
                        <IconDotsVertical size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => onCopyItem(item)}>
                        Copy
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
  )
}
