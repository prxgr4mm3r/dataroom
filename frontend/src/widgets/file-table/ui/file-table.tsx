import { IconDotsVertical, IconFile, IconFolder, IconPointFilled, IconTrash } from '@tabler/icons-react'

import type { ContentItem } from '@/entities/content-item'
import { isFileItem } from '@/entities/content-item'
import { formatDate } from '@/shared/lib/date/format-date'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { ActionIcon, Checkbox, Group, Menu, ScrollArea, Table, Text } from '@/shared/ui'
import type { SortBy, SortOrder } from '@/shared/types/common'

type FileTableProps = {
  items: ContentItem[]
  loading: boolean
  openedPreviewId: string | null
  selectedIds: string[]
  sortBy: SortBy
  sortOrder: SortOrder
  onToggleSort: (sortBy: SortBy) => void
  onToggleSelect: (itemId: string) => void
  onOpenFile: (itemId: string) => void
  onOpenFolder: (folderId: string) => void
  onDeleteItem: (item: ContentItem) => void
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
  <Table.Th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={onClick}>
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
  openedPreviewId,
  selectedIds,
  sortBy,
  sortOrder,
  onToggleSort,
  onToggleSelect,
  onOpenFile,
  onOpenFolder,
  onDeleteItem,
}: FileTableProps) => {
  if (loading) {
    return (
      <Text c="dimmed" p="md">
        Loading...
      </Text>
    )
  }

  if (!items.length) {
    return (
      <Text c="dimmed" p="md">
        This folder is empty.
      </Text>
    )
  }

  return (
    <ScrollArea h="100%">
      <Table stickyHeader highlightOnHover withTableBorder withColumnBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={44} />
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
            <SortableHeader
              label="Imported at"
              active={sortBy === 'imported_at'}
              order={sortOrder}
              onClick={() => onToggleSort('imported_at')}
            />
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id)
            const isOpened = openedPreviewId === item.id

            return (
              <Table.Tr key={item.id} bg={isOpened ? '#eef2ff' : undefined}>
                <Table.Td>
                  <Checkbox
                    checked={isSelected}
                    aria-label={`Select ${item.name}`}
                    onChange={() => onToggleSelect(item.id)}
                  />
                </Table.Td>

                <Table.Td
                  style={{ cursor: 'pointer' }}
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
                <Table.Td>{item.kind === 'folder' ? 'Folder' : item.mimeType || '-'}</Table.Td>
                <Table.Td>{formatFileSize(item.sizeBytes)}</Table.Td>
                <Table.Td>{formatDate(item.importedAt)}</Table.Td>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <IconPointFilled
                      size={10}
                      color={item.status === 'active' ? '#2f9e44' : item.status === 'failed' ? '#e03131' : '#adb5bd'}
                    />
                    <Text size="xs" tt="capitalize">
                      {item.status}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Menu withinPortal position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${item.name}`}>
                        <IconDotsVertical size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
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
