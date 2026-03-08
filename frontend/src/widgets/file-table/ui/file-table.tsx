import {
  IconArrowsMove,
  IconAlertTriangle,
  IconBrandGoogleDrive,
  IconCloudUpload,
  IconCopy,
  IconDownload,
  IconDotsVertical,
  IconEdit,
  IconFolder,
  IconLink,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { useRef, type DragEvent } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { isFileItem } from '@/entities/content-item'
import type { DragImportOverlayState } from '@/features/drag-import-files'
import { t } from '@/shared/i18n/messages'
import { formatDate, formatDateCompact } from '@/shared/lib/date/format-date'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/shared/lib/file/import-file-size-limit'
import { splitFileName } from '@/shared/lib/file/split-file-name'
import {
  ActionIcon,
  Box,
  Button,
  FileTypeIcon,
  Group,
  Loader,
  Menu,
  ScrollArea,
  SelectionCheckbox,
  Table,
  Text,
} from '@/shared/ui'
import type { SortBy, SortOrder } from '@/shared/types/common'
import './file-table.css'

type DropState = 'none' | 'valid' | 'warning' | 'invalid'
type ToggleSelectOptions = {
  range?: boolean
  keepExisting?: boolean
}

type FileTableProps = {
  readOnly?: boolean
  items: ContentItem[]
  loading: boolean
  currentFolderId: string
  openedPreviewId: string | null
  selectedIds: string[]
  sortBy: SortBy
  sortOrder: SortOrder
  onToggleSort: (sortBy: SortBy) => void
  onToggleSelect: (itemId: string, options?: ToggleSelectOptions) => void
  onToggleSelectAll?: (checked: boolean) => void
  onOpenFile: (itemId: string) => void
  onOpenFolder: (folderId: string) => void
  onDownloadItem: (item: ContentItem) => void
  onImportFromGoogle?: () => void
  onImportFromComputer?: () => void
  importFromComputerPending?: boolean
  onCopyItem?: (item: ContentItem) => void
  onRenameItem?: (item: ContentItem) => void
  onMoveItem?: (item: ContentItem) => void
  onDeleteItem?: (item: ContentItem) => void
  onShareItem?: (item: ContentItem) => void
  onClearSelection?: () => void
  onDownloadSelected?: () => void
  onCopySelected?: () => void
  onMoveSelected?: () => void
  onDeleteSelected?: () => void
  downloadPending?: boolean
  copyPending?: boolean
  movePending?: boolean
  deletePending?: boolean
  onDragStartItem?: (itemId: string, event: DragEvent<HTMLTableRowElement>) => void
  onDragEnd?: () => void
  onFolderDragOver?: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave?: (folderId: string) => void
  onFolderDrop?: (folderId: string, event: DragEvent<HTMLElement>) => void
  getFolderDropState?: (folderId: string) => DropState
  importOverlayState?: DragImportOverlayState
  moveOverlayItemCount?: number
  isDraggingItem?: (itemId: string) => boolean
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

const formatDraggedItemCount = (count: number): string => {
  if (count <= 0) {
    return 'items'
  }

  if (count === 1) {
    return '1 item'
  }

  return `${count} items`
}

const EMPTY_IMPORT_OVERLAY: DragImportOverlayState = { mode: 'none' }
const NOOP_DROP_STATE = (): DropState => 'none'
const NOOP_IS_DRAGGING = (): boolean => false
const NOOP_DRAG_END = (): void => {}
const NOOP_FOLDER_DRAG_LEAVE = (): void => {}
const NOOP_ROW_DRAG_START = (): void => {}
const NOOP_FOLDER_DRAG_OVER = (): void => {}
const NOOP_FOLDER_DROP = (): void => {}

const SortableHeader = ({
  label,
  active,
  order,
  onClick,
  className,
}: {
  label: string
  active: boolean
  order: SortOrder
  onClick: () => void
  className?: string
}) => (
  <Table.Th
    className={['file-table__th', 'file-table__th--sortable', className].filter(Boolean).join(' ')}
    style={{ whiteSpace: 'nowrap' }}
    onClick={onClick}
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
  readOnly = false,
  items,
  loading,
  currentFolderId,
  openedPreviewId,
  selectedIds,
  sortBy,
  sortOrder,
  onToggleSort,
  onToggleSelect,
  onToggleSelectAll,
  onOpenFile,
  onOpenFolder,
  onDownloadItem,
  onImportFromGoogle,
  onImportFromComputer,
  importFromComputerPending = false,
  onCopyItem,
  onRenameItem,
  onMoveItem,
  onDeleteItem,
  onShareItem,
  onClearSelection,
  onDownloadSelected,
  onCopySelected,
  onMoveSelected,
  onDeleteSelected,
  downloadPending = false,
  copyPending = false,
  movePending = false,
  deletePending = false,
  onDragStartItem = NOOP_ROW_DRAG_START,
  onDragEnd = NOOP_DRAG_END,
  onFolderDragOver = NOOP_FOLDER_DRAG_OVER,
  onFolderDragLeave = NOOP_FOLDER_DRAG_LEAVE,
  onFolderDrop = NOOP_FOLDER_DROP,
  getFolderDropState = NOOP_DROP_STATE,
  importOverlayState = EMPTY_IMPORT_OVERLAY,
  moveOverlayItemCount = 0,
  isDraggingItem = NOOP_IS_DRAGGING,
}: FileTableProps) => {
  const pendingToggleOptionsRef = useRef<ToggleSelectOptions | null>(null)
  const currentFolderDropState = readOnly ? 'none' : getFolderDropState(currentFolderId)
  const compactUpdatedAt = Boolean(openedPreviewId)
  const tableClassName = ['file-table', compactUpdatedAt ? 'file-table--preview-open' : ''].filter(Boolean).join(' ')
  const selectedIdSet = new Set(selectedIds)
  const visibleSelectedCount = items.reduce((count, item) => count + (selectedIdSet.has(item.id) ? 1 : 0), 0)
  const allVisibleSelected = items.length > 0 && visibleSelectedCount === items.length
  const partiallyVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected
  const hasVisibleSelection = visibleSelectedCount > 0
  const selectedCount = selectedIds.length
  const showBulkHeaderActions = selectedCount > 0 && Boolean(onClearSelection) && Boolean(onDownloadSelected)
  const isImportOverlayActive = !readOnly && importOverlayState.mode !== 'none'
  const isMoveOverlayActive =
    !readOnly && !isImportOverlayActive && moveOverlayItemCount > 0 && currentFolderDropState !== 'none'
  const maxImportSizeLabel = formatFileSize(MAX_IMPORT_FILE_SIZE_BYTES).replace('.0 ', ' ')
  const draggedFileCountLabel =
    importOverlayState.mode === 'none' ? '' : formatDraggedFileCount(importOverlayState.fileCount)
  const draggedItemCountLabel = formatDraggedItemCount(moveOverlayItemCount)

  const renderImportOverlay = () => {
    if (readOnly) {
      return null
    }

    if (importOverlayState.mode === 'none') {
      return null
    }

    if (importOverlayState.mode === 'uploading') {
      return (
        <div className="file-table__drop-overlay file-table__drop-overlay--uploading" aria-live="polite">
          <div className="file-table__drop-overlay-card">
            <span className="file-table__drop-overlay-icon">
              <Loader size={18} color="var(--accent)" />
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

  const renderMoveOverlay = () => {
    if (!isMoveOverlayActive) {
      return null
    }

    if (currentFolderDropState === 'warning') {
      return (
        <div className="file-table__drop-overlay file-table__drop-overlay--warning" aria-live="polite">
          <div className="file-table__drop-overlay-card">
            <span className="file-table__drop-overlay-icon">
              <IconAlertTriangle size={18} stroke={2} />
            </span>
            <div>
              <Text size="sm" fw={700}>
                Items are already in this folder.
              </Text>
              <Text size="xs" c="dimmed">
                Choose another destination folder to move them.
              </Text>
            </div>
          </div>
        </div>
      )
    }

    if (currentFolderDropState === 'invalid') {
      return (
        <div className="file-table__drop-overlay file-table__drop-overlay--too-large" aria-live="polite">
          <div className="file-table__drop-overlay-card">
            <span className="file-table__drop-overlay-icon">
              <IconAlertTriangle size={18} stroke={2} />
            </span>
            <div>
              <Text size="sm" fw={700}>
                This destination is not available.
              </Text>
              <Text size="xs" c="dimmed">
                You can&apos;t move items to this folder.
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
            <IconArrowsMove size={18} stroke={2} />
          </span>
          <div>
            <Text size="sm" fw={700}>
              Drop to move {draggedItemCountLabel}.
            </Text>
            <Text size="xs" c="dimmed">
              Items will be moved to this folder.
            </Text>
          </div>
        </div>
      </div>
    )
  }

  const handleRootDragLeave = (event: DragEvent<HTMLElement>) => {
    if (readOnly) {
      return
    }
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
      if (currentFolderDropState === 'invalid') {
        emptyBackground = 'var(--state-danger-bg)'
      }
    }

    return (
      <Box
        className="file-table__container file-table__empty-wrap"
        p="md"
        h="100%"
        bg={emptyBackground}
        style={{ minHeight: 220 }}
        onDragOver={readOnly ? undefined : (event) => onFolderDragOver(currentFolderId, event)}
        onDrop={readOnly ? undefined : (event) => onFolderDrop(currentFolderId, event)}
        onDragLeave={readOnly ? undefined : handleRootDragLeave}
      >
        {readOnly ? <Text c="dimmed">This folder is empty.</Text> : null}
        {!readOnly && !isImportOverlayActive && !isMoveOverlayActive ? (
          <div className="file-table__empty-center">
            <div className="file-table__empty-state">
              <span className="file-table__empty-state-icon" aria-hidden="true">
                <IconCloudUpload size={22} />
              </span>
              <Text size="sm" fw={700}>
                This folder is empty.
              </Text>
              <Text size="xs" c="dimmed" className="file-table__empty-state-hint">
                Import files up to {maxImportSizeLabel}. Drag and drop files here to upload.
              </Text>
              <Group gap="xs" className="file-table__empty-state-actions">
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconBrandGoogleDrive size={14} />}
                  onClick={onImportFromGoogle}
                  disabled={!onImportFromGoogle}
                >
                  Import from Google Drive
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconUpload size={14} />}
                  onClick={onImportFromComputer}
                  disabled={!onImportFromComputer}
                  loading={importFromComputerPending}
                >
                  Upload from computer
                </Button>
              </Group>
            </div>
          </div>
        ) : null}
        {isImportOverlayActive ? renderImportOverlay() : null}
        {isMoveOverlayActive ? renderMoveOverlay() : null}
      </Box>
    )
  }

  return (
    <Box
      className="file-table__container"
      h="100%"
      onDragOver={readOnly ? undefined : (event) => onFolderDragOver(currentFolderId, event)}
      onDrop={readOnly ? undefined : (event) => onFolderDrop(currentFolderId, event)}
      onDragLeave={readOnly ? undefined : handleRootDragLeave}
    >
      <ScrollArea h="100%">
        <Table className={tableClassName} stickyHeader highlightOnHover withColumnBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="file-table__th file-table__th--select" w={44}>
                <span className="file-table__select-control">
                  <SelectionCheckbox
                    checked={allVisibleSelected}
                    indeterminate={partiallyVisibleSelected}
                    disabled={!onToggleSelectAll || !items.length}
                    ariaLabel={hasVisibleSelection ? 'Clear selection for all items' : 'Select all items'}
                    onCheckedChange={(checked) => {
                      if (partiallyVisibleSelected) {
                        onToggleSelectAll?.(false)
                        return
                      }
                      onToggleSelectAll?.(checked)
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </span>
              </Table.Th>
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
                className={showBulkHeaderActions ? 'file-table__th--bulk-hidden' : undefined}
              />
              <SortableHeader
                label="Size"
                active={sortBy === 'size'}
                order={sortOrder}
                onClick={() => onToggleSort('size')}
                className={['file-table__th--size', showBulkHeaderActions ? 'file-table__th--bulk-hidden' : '']
                  .filter(Boolean)
                  .join(' ')}
              />
              <Table.Th
                className={[
                  'file-table__th',
                  'file-table__th--updated',
                  showBulkHeaderActions ? 'file-table__th--bulk-hidden' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ whiteSpace: 'nowrap' }}
              >
                {compactUpdatedAt ? 'Updated' : 'Updated at'}
              </Table.Th>
              <Table.Th className="file-table__th file-table__th--actions file-table__th--actions-anchor" w={56}>
                {showBulkHeaderActions ? (
                  <div className="file-table__bulk-header-overlay">
                    <Text size="sm" fw={600} className="file-table__bulk-count">
                      {selectedCount === 1 ? '1 item selected' : `${selectedCount} items selected`}
                    </Text>
                    <Group gap="xs" wrap="nowrap" className="file-table__bulk-actions">
                      <Button
                        variant="subtle"
                        size="xs"
                        leftSection={<IconX size={14} />}
                        onClick={onClearSelection}
                        className="file-table__bulk-button"
                      >
                        <span className="file-table__bulk-button-label">{t('clearSelection')}</span>
                      </Button>
                      <Button
                        variant="default"
                        size="xs"
                        leftSection={<IconDownload size={14} />}
                        onClick={onDownloadSelected}
                        loading={downloadPending}
                        className="file-table__bulk-button"
                      >
                        <span className="file-table__bulk-button-label">{t('download')}</span>
                      </Button>
                      {onCopySelected ? (
                        <Button
                          variant="default"
                          size="xs"
                          leftSection={<IconCopy size={14} />}
                          onClick={onCopySelected}
                          loading={copyPending}
                          className="file-table__bulk-button"
                        >
                          <span className="file-table__bulk-button-label">{t('copy')}</span>
                        </Button>
                      ) : null}
                      {onMoveSelected ? (
                        <Button
                          variant="default"
                          size="xs"
                          leftSection={<IconArrowsMove size={14} />}
                          onClick={onMoveSelected}
                          loading={movePending}
                          className="file-table__bulk-button"
                        >
                          <span className="file-table__bulk-button-label">{t('move')}</span>
                        </Button>
                      ) : null}
                      {onDeleteSelected ? (
                        <Button
                          color="red"
                          variant="light"
                          size="xs"
                          leftSection={<IconTrash size={14} />}
                          onClick={onDeleteSelected}
                          loading={deletePending}
                          className="file-table__bulk-button"
                        >
                          <span className="file-table__bulk-button-label">{t('deleteSelected')}</span>
                        </Button>
                      ) : null}
                    </Group>
                  </div>
                ) : null}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {items.map((item) => {
              const isSelected = selectedIdSet.has(item.id)
              const isOpened = openedPreviewId === item.id
              const isFolder = !isFileItem(item)
              const dropState = !readOnly && isFolder ? getFolderDropState(item.id) : 'none'
              const isDragging = !readOnly && isDraggingItem(item.id)
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
                rowBackground = 'var(--state-success-bg)'
              } else if (dropState === 'warning') {
                rowBackground = 'var(--state-warning-bg)'
              } else if (dropState === 'invalid') {
                rowBackground = 'var(--state-danger-bg)'
              } else if (isOpened) {
                rowBackground = 'var(--accent-soft)'
              }
              const hasPrimaryMenuActions = Boolean(onRenameItem)
              const hasSecondaryMenuActions = Boolean(onShareItem || onDownloadItem || onCopyItem || onMoveItem)
              const hasDeleteMenuAction = Boolean(onDeleteItem)

              return (
                <Table.Tr
                  key={item.id}
                  className="file-table__row"
                  bg={rowBackground}
                  draggable={!readOnly}
                  onDragStart={readOnly ? undefined : (event) => onDragStartItem(item.id, event)}
                  onDragEnd={readOnly ? undefined : onDragEnd}
                  onDragOver={
                    !readOnly && isFolder
                      ? (event) => {
                          event.stopPropagation()
                          onFolderDragOver(item.id, event)
                        }
                      : undefined
                  }
                  onDragLeave={
                    !readOnly && isFolder
                      ? (event) => {
                          event.stopPropagation()
                          onFolderDragLeave(item.id)
                        }
                      : undefined
                  }
                  onDrop={
                    !readOnly && isFolder
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
                        onCheckedChange={() => {
                          const options = pendingToggleOptionsRef.current ?? undefined
                          pendingToggleOptionsRef.current = null
                          onToggleSelect(item.id, options)
                        }}
                        onClick={(event) => {
                          event.stopPropagation()
                          pendingToggleOptionsRef.current = event.shiftKey
                            ? {
                                range: true,
                                keepExisting: event.metaKey || event.ctrlKey,
                              }
                            : null
                        }}
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
                          <IconFolder size={16} color="var(--accent)" />
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
                    {readOnly ? (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Download ${item.name}`}
                        onClick={() => onDownloadItem(item)}
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                    ) : (
                      <Menu withinPortal position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${item.name}`}>
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {onRenameItem ? (
                            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onRenameItem(item)}>
                              Rename
                            </Menu.Item>
                          ) : null}
                          {hasPrimaryMenuActions && (hasSecondaryMenuActions || hasDeleteMenuAction) ? (
                            <Menu.Divider />
                          ) : null}
                          {onShareItem ? (
                            <Menu.Item leftSection={<IconLink size={14} />} onClick={() => onShareItem(item)}>
                              Share
                            </Menu.Item>
                          ) : null}
                          <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => onDownloadItem(item)}>
                            Download
                          </Menu.Item>
                          {onCopyItem ? (
                            <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => onCopyItem(item)}>
                              Copy
                            </Menu.Item>
                          ) : null}
                          {onMoveItem ? (
                            <Menu.Item leftSection={<IconArrowsMove size={14} />} onClick={() => onMoveItem(item)}>
                              Move
                            </Menu.Item>
                          ) : null}
                          {hasSecondaryMenuActions && hasDeleteMenuAction ? <Menu.Divider /> : null}
                          {onDeleteItem ? (
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => onDeleteItem(item)}
                            >
                              Delete
                            </Menu.Item>
                          ) : null}
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {renderImportOverlay()}
      {renderMoveOverlay()}
    </Box>
  )
}
