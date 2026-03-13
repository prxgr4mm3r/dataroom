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
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { isFileItem } from '@/entities/content-item'
import type { DragImportOverlayState } from '@/features/drag-import-files'
import { useDragSelectionController } from '@/features/select-content-items'
import { t } from '@/shared/i18n/messages'
import { formatDate } from '@/shared/lib/date/format-date'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { MAX_IMPORT_BATCH_SIZE_BYTES, MAX_IMPORT_FILE_SIZE_BYTES } from '@/shared/lib/file/import-file-size-limit'
import { APP_SHORTCUTS, withShortcutHint } from '@/shared/lib/keyboard/shortcuts'
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
import { computeMiddleEllipsisText } from './middle-ellipsis'

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
  onSetSelection?: (itemIds: string[]) => void
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

type ContextMenuState = {
  item: ContentItem
  x: number
  y: number
}

type ItemActionsMenuContentProps = {
  item: ContentItem
  readOnly: boolean
  onDownloadItem: (item: ContentItem) => void
  onCopyItem?: (item: ContentItem) => void
  onRenameItem?: (item: ContentItem) => void
  onMoveItem?: (item: ContentItem) => void
  onDeleteItem?: (item: ContentItem) => void
  onShareItem?: (item: ContentItem) => void
  onAction?: () => void
}

const ItemActionsMenuContent = ({
  item,
  readOnly,
  onDownloadItem,
  onCopyItem,
  onRenameItem,
  onMoveItem,
  onDeleteItem,
  onShareItem,
  onAction,
}: ItemActionsMenuContentProps) => {
  const runAction = (handler: (item: ContentItem) => void): (() => void) => {
    return () => {
      onAction?.()
      handler(item)
    }
  }
  const hasPrimaryMenuActions = !readOnly && Boolean(onRenameItem)
  const hasSecondaryMenuActions = Boolean(onShareItem || onDownloadItem || onCopyItem || onMoveItem)
  const hasDeleteMenuAction = !readOnly && Boolean(onDeleteItem)

  if (readOnly) {
    return (
      <Menu.Item leftSection={<IconDownload size={14} />} onClick={runAction(onDownloadItem)}>
        Download
      </Menu.Item>
    )
  }

  return (
    <>
      {onRenameItem ? (
        <Menu.Item leftSection={<IconEdit size={14} />} onClick={runAction(onRenameItem)}>
          Rename
        </Menu.Item>
      ) : null}
      {hasPrimaryMenuActions && (hasSecondaryMenuActions || hasDeleteMenuAction) ? <Menu.Divider /> : null}
      {onShareItem ? (
        <Menu.Item leftSection={<IconLink size={14} />} onClick={runAction(onShareItem)}>
          Share
        </Menu.Item>
      ) : null}
      <Menu.Item leftSection={<IconDownload size={14} />} onClick={runAction(onDownloadItem)}>
        Download
      </Menu.Item>
      {onCopyItem ? (
        <Menu.Item leftSection={<IconCopy size={14} />} onClick={runAction(onCopyItem)}>
          Copy
        </Menu.Item>
      ) : null}
      {onMoveItem ? (
        <Menu.Item leftSection={<IconArrowsMove size={14} />} onClick={runAction(onMoveItem)}>
          Move
        </Menu.Item>
      ) : null}
      {hasSecondaryMenuActions && hasDeleteMenuAction ? <Menu.Divider /> : null}
      {onDeleteItem ? (
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={runAction(onDeleteItem)}>
          Delete
        </Menu.Item>
      ) : null}
    </>
  )
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
const NOOP_SET_SELECTION = (): void => {}

const INTERACTIVE_TARGET_SELECTOR = [
  'a',
  'button',
  'input',
  'label',
  '[role="button"]',
  '.mantine-Menu-dropdown',
  '.mantine-ActionIcon-root',
  '.mantine-Checkbox-root',
].join(',')

export const MiddleEllipsisText = ({
  text,
  preserveExtension = false,
  className,
}: {
  text: string
  preserveExtension?: boolean
  className?: string
}) => {
  const containerRef = useRef<HTMLSpanElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [displayText, setDisplayText] = useState(text)

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) {
      return
    }

    const measureWidth = (value: string) => {
      measure.textContent = value
      return measure.offsetWidth
    }

    const update = () => {
      const availableWidth = container.parentElement?.clientWidth || container.clientWidth
      setDisplayText(
        computeMiddleEllipsisText({
          text,
          availableWidth,
          preserveExtension,
          measureWidth,
        }),
      )
    }

    update()

    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [preserveExtension, text])

  return (
    <span
      ref={containerRef}
      data-testid="middle-ellipsis-root"
      className={['relative block min-w-0 overflow-hidden whitespace-nowrap', className].filter(Boolean).join(' ')}
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap opacity-0"
      />
      <span data-testid="middle-ellipsis-value" className="block overflow-hidden text-ellipsis whitespace-nowrap">
        {displayText}
      </span>
    </span>
  )
}

const canStartAreaSelectionFromEvent = (event: PointerEvent<HTMLElement>): boolean => {
  const target = event.target
  if (!(target instanceof Element)) {
    return false
  }

  if (!target.closest('.file-table__container')) {
    return false
  }

  if (target.closest(INTERACTIVE_TARGET_SELECTOR)) {
    return false
  }

  if (target.closest('thead')) {
    return false
  }

  const isRowTarget = Boolean(target.closest('tr.file-table__row'))
  if (isRowTarget && !(event.ctrlKey || event.metaKey)) {
    return false
  }

  return true
}

const SortableHeader = ({
  label,
  active,
  order,
  onClick,
  className,
  hidden = false,
}: {
  label: string
  active: boolean
  order: SortOrder
  onClick: () => void
  className?: string
  hidden?: boolean
}) => (
  <Table.Th
    className={[
      'file-table__th file-table__th--sortable h-11 border-b border-[var(--table-separator)] bg-[var(--table-header-bg)] py-0 align-middle font-semibold text-[var(--text-secondary)] cursor-pointer',
      hidden && 'pointer-events-none',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    style={{ whiteSpace: 'nowrap' }}
    onClick={hidden ? undefined : onClick}
    aria-label={hidden ? label : undefined}
  >
    {hidden ? null : (
      <Group gap={4} wrap="nowrap">
        <Text size="sm" fw={600}>
          {label}
        </Text>
        {active ? <Text size="xs">{order === 'asc' ? '↑' : '↓'}</Text> : null}
      </Group>
    )}
  </Table.Th>
)

const TABLE_CLASS_NAME =
  'file-table m-0 w-full table-fixed border-none border-collapse'

const TH_BASE_CLASS_NAME =
  'file-table__th h-11 border-b border-[var(--table-separator)] bg-[var(--table-header-bg)] py-0 align-middle font-semibold text-[var(--text-secondary)]'

const TD_BASE_CLASS_NAME =
  'file-table__td overflow-hidden whitespace-nowrap border-b border-[var(--table-separator)] py-[11px] align-middle group-hover:shadow-[inset_0_1px_0_var(--table-row-hover-border),inset_0_-1px_0_var(--table-row-hover-border)]'

const SELECT_COLUMN_CLASS_NAME =
  'w-[var(--file-table-select-col-width)] min-w-[var(--file-table-select-col-width)] max-w-[var(--file-table-select-col-width)]'

const SIZE_COLUMN_CLASS_NAME =
  'whitespace-nowrap w-[var(--file-table-size-col-width)] min-w-[var(--file-table-size-col-width)] max-w-[var(--file-table-size-col-width)] transition-[width,min-width,max-width] duration-[var(--file-table-layout-ms)] ease-[var(--file-table-layout-ease)] motion-reduce:transition-none'

const TYPE_COLUMN_CLASS_NAME =
  'whitespace-nowrap w-[var(--file-table-type-col-width)] min-w-[var(--file-table-type-col-width)] max-w-[var(--file-table-type-col-width)] overflow-hidden text-ellipsis transition-[width,min-width,max-width] duration-[var(--file-table-layout-ms)] ease-[var(--file-table-layout-ease)] motion-reduce:transition-none'

const UPDATED_COLUMN_CLASS_NAME =
  'whitespace-nowrap w-[var(--file-table-updated-col-width)] min-w-[var(--file-table-updated-col-width)] max-w-[var(--file-table-updated-col-width)] transition-[width,min-width,max-width] duration-[var(--file-table-layout-ms)] ease-[var(--file-table-layout-ease)] motion-reduce:transition-none'

const ACTIONS_COLUMN_CLASS_NAME =
  'w-[var(--file-table-actions-col-width)] min-w-[var(--file-table-actions-col-width)] max-w-[var(--file-table-actions-col-width)]'

const FILE_TABLE_NAME_MIN_WIDTH = 260
const FILE_TABLE_FULL_MIN_WIDTH = 44 + FILE_TABLE_NAME_MIN_WIDTH + 168 + 98 + 168 + 56
const FILE_TABLE_NO_TYPE_MIN_WIDTH = 44 + FILE_TABLE_NAME_MIN_WIDTH + 98 + 168 + 56
const FILE_TABLE_NO_TYPE_UPDATED_MIN_WIDTH = 44 + FILE_TABLE_NAME_MIN_WIDTH + 98 + 56
const FILE_TABLE_NO_TYPE_UPDATED_SIZE_MIN_WIDTH = 44 + FILE_TABLE_NAME_MIN_WIDTH + 56
const FILE_TABLE_BULK_COUNT_MIN_WIDTH = 860
const FILE_TABLE_BULK_TEXT_BUTTONS_MIN_WIDTH = 700

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
  onSetSelection = NOOP_SET_SELECTION,
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
  const containerRef = useRef<HTMLDivElement>(null)
  const selectionOverlayRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const [isAreaSelectionModifierPressed, setIsAreaSelectionModifierPressed] = useState(false)
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const pendingToggleOptionsRef = useRef<ToggleSelectOptions | null>(null)
  const currentFolderDropState = readOnly ? 'none' : getFolderDropState(currentFolderId)
  const tableStyle: CSSProperties = {
    ['--file-table-layout-ms' as string]: '220ms',
    ['--file-table-layout-ease' as string]: 'cubic-bezier(0.2, 0, 0, 1)',
    ['--file-table-select-col-width' as string]: '44px',
    ['--file-table-type-col-width' as string]: '168px',
    ['--file-table-size-col-width' as string]: '98px',
    ['--file-table-updated-col-width' as string]: '168px',
    ['--file-table-actions-col-width' as string]: '56px',
    ['--table-layout' as string]: 'fixed',
    ['--mantine-color-body' as string]: 'var(--table-header-bg)',
    ['--table-sticky-header-background-color' as string]: 'var(--table-header-bg)',
    ['--table-highlight-on-hover-color' as string]: 'var(--table-row-hover-bg)',
  }
  const isImportOverlayActive = !readOnly && importOverlayState.mode !== 'none'
  const isMoveOverlayActive =
    !readOnly && !isImportOverlayActive && moveOverlayItemCount > 0 && currentFolderDropState !== 'none'
  const hasAreaSelectionHandler = onSetSelection !== NOOP_SET_SELECTION
  const isAreaSelectionEnabled =
    !readOnly && hasAreaSelectionHandler && !isImportOverlayActive && !isMoveOverlayActive
  const maxImportSizeLabel = formatFileSize(MAX_IMPORT_FILE_SIZE_BYTES).replace('.0 ', ' ')
  const maxImportBatchSizeLabel = formatFileSize(MAX_IMPORT_BATCH_SIZE_BYTES).replace('.0 ', ' ')
  const uploadFromComputerLabelWithShortcut = withShortcutHint('Upload from computer', APP_SHORTCUTS.importFromComputer.label)
  const importFromGoogleLabelWithShortcut = withShortcutHint('Import from Google Drive', APP_SHORTCUTS.importFromGoogle.label)
  const uploadFromComputerShortcutLabel = APP_SHORTCUTS.importFromComputer.compactLabel
  const importFromGoogleShortcutLabel = APP_SHORTCUTS.importFromGoogle.compactLabel
  const draggedFileCountLabel =
    importOverlayState.mode === 'none' ? '' : formatDraggedFileCount(importOverlayState.fileCount)
  const draggedItemCountLabel = formatDraggedItemCount(moveOverlayItemCount)
  const dragSelection = useDragSelectionController({
    isEnabled: isAreaSelectionEnabled,
    selectedIds,
    onSelectionChange: onSetSelection,
    onOverlayRectChange: (rect) => {
      const overlayElement = selectionOverlayRef.current
      if (!overlayElement) {
        return
      }

      if (!rect) {
        overlayElement.style.left = '0px'
        overlayElement.style.top = '0px'
        overlayElement.style.width = '0px'
        overlayElement.style.height = '0px'
        return
      }

      overlayElement.style.left = `${rect.x}px`
      overlayElement.style.top = `${rect.y}px`
      overlayElement.style.width = `${rect.width}px`
      overlayElement.style.height = `${rect.height}px`
    },
    getContainerElement: () => containerRef.current,
    getItemRects: () =>
      items.flatMap((item) => {
        const rowElement = rowRefs.current.get(item.id)
        if (!rowElement) {
          return []
        }
        return [
          {
            id: item.id,
            rect: rowElement.getBoundingClientRect(),
          },
        ]
      }),
    canStartSelection: canStartAreaSelectionFromEvent,
  })
  const effectiveSelectedIds = dragSelection.previewSelectedIds ?? selectedIds
  const contextMenuItem = contextMenuState ? items.find((item) => item.id === contextMenuState.item.id) ?? null : null
  const selectedIdSet = new Set(effectiveSelectedIds)
  const visibleSelectedCount = items.reduce((count, item) => count + (selectedIdSet.has(item.id) ? 1 : 0), 0)
  const allVisibleSelected = items.length > 0 && visibleSelectedCount === items.length
  const partiallyVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected
  const hasVisibleSelection = visibleSelectedCount > 0
  const selectedCount = effectiveSelectedIds.length
  const showBulkHeaderActions = selectedCount > 0 && Boolean(onClearSelection) && Boolean(onDownloadSelected)
  const showTypeColumn = containerWidth >= FILE_TABLE_FULL_MIN_WIDTH
  const showUpdatedColumn = containerWidth >= FILE_TABLE_NO_TYPE_MIN_WIDTH
  const showSizeColumn = containerWidth >= FILE_TABLE_NO_TYPE_UPDATED_MIN_WIDTH
  const showActionsColumn = showBulkHeaderActions || containerWidth >= FILE_TABLE_NO_TYPE_UPDATED_SIZE_MIN_WIDTH
  const showBulkCountLabel = containerWidth >= FILE_TABLE_BULK_COUNT_MIN_WIDTH
  const showBulkButtonLabels = containerWidth >= FILE_TABLE_BULK_TEXT_BUTTONS_MIN_WIDTH

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        setIsAreaSelectionModifierPressed(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        setIsAreaSelectionModifierPressed(false)
      }
    }

    const handleBlur = () => {
      setIsAreaSelectionModifierPressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  useEffect(() => {
    if (!contextMenuState) {
      return
    }

    const handleWindowScroll = () => {
      setContextMenuState(null)
    }

    window.addEventListener('scroll', handleWindowScroll, true)
    return () => {
      window.removeEventListener('scroll', handleWindowScroll, true)
    }
  }, [contextMenuState])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const updateWidth = () => {
      setContainerWidth(container.clientWidth)
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const renderImportOverlay = () => {
    if (readOnly) {
      return null
    }

    if (importOverlayState.mode === 'none') {
      return null
    }

    if (importOverlayState.mode === 'uploading') {
      return (
        <div
          className="file-table__drop-overlay pointer-events-none absolute inset-0 z-[8] flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--drop-upload-border)] bg-[var(--drop-upload-bg)]"
          aria-live="polite"
        >
          <div className="file-table__drop-overlay-card flex max-w-[520px] items-center gap-2.5 rounded-[10px] bg-[var(--overlay-card-bg)] px-[18px] py-[14px] shadow-[var(--overlay-card-shadow)]">
            <span className="file-table__drop-overlay-icon inline-flex items-center justify-center">
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
        <div
          className="file-table__drop-overlay pointer-events-none absolute inset-0 z-[8] flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--drop-warning-border)] bg-[var(--drop-warning-bg)]"
          aria-live="polite"
        >
          <div className="file-table__drop-overlay-card flex max-w-[520px] items-center gap-2.5 rounded-[10px] bg-[var(--overlay-card-bg)] px-[18px] py-[14px] shadow-[var(--overlay-card-shadow)]">
            <span className="file-table__drop-overlay-icon inline-flex items-center justify-center text-[var(--drop-icon-warning)]">
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
        <div
          className="file-table__drop-overlay pointer-events-none absolute inset-0 z-[8] flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--drop-danger-border)] bg-[var(--drop-danger-bg)]"
          aria-live="polite"
        >
          <div className="file-table__drop-overlay-card flex max-w-[520px] items-center gap-2.5 rounded-[10px] bg-[var(--overlay-card-bg)] px-[18px] py-[14px] shadow-[var(--overlay-card-shadow)]">
            <span className="file-table__drop-overlay-icon inline-flex items-center justify-center text-[var(--drop-icon-danger)]">
              <IconAlertTriangle size={18} stroke={2} />
            </span>
            <div>
              <Text size="sm" fw={700}>
                All selected files are too large.
              </Text>
              <Text size="xs" c="dimmed">
                Maximum size per file: {formatFileSize(MAX_IMPORT_FILE_SIZE_BYTES)}. Per import: {formatFileSize(MAX_IMPORT_BATCH_SIZE_BYTES)}.
              </Text>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        className="file-table__drop-overlay pointer-events-none absolute inset-0 z-[8] flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--drop-ready-border)] bg-[var(--drop-ready-bg)]"
        aria-live="polite"
      >
        <div className="file-table__drop-overlay-card flex max-w-[520px] items-center gap-2.5 rounded-[10px] bg-[var(--overlay-card-bg)] px-[18px] py-[14px] shadow-[var(--overlay-card-shadow)]">
          <span className="file-table__drop-overlay-icon inline-flex items-center justify-center text-[var(--drop-icon-ready)]">
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
        <div
          className="file-table__drop-overlay pointer-events-none absolute inset-0 z-[8] flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--drop-warning-border)] bg-[var(--drop-warning-bg)]"
          aria-live="polite"
        >
          <div className="file-table__drop-overlay-card flex max-w-[520px] items-center gap-2.5 rounded-[10px] bg-[var(--overlay-card-bg)] px-[18px] py-[14px] shadow-[var(--overlay-card-shadow)]">
            <span className="file-table__drop-overlay-icon inline-flex items-center justify-center text-[var(--drop-icon-warning)]">
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
        <div
          className="file-table__drop-overlay pointer-events-none absolute inset-0 z-[8] flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--drop-danger-border)] bg-[var(--drop-danger-bg)]"
          aria-live="polite"
        >
          <div className="file-table__drop-overlay-card flex max-w-[520px] items-center gap-2.5 rounded-[10px] bg-[var(--overlay-card-bg)] px-[18px] py-[14px] shadow-[var(--overlay-card-shadow)]">
            <span className="file-table__drop-overlay-icon inline-flex items-center justify-center text-[var(--drop-icon-danger)]">
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
      <div
        className="file-table__drop-overlay pointer-events-none absolute inset-0 z-[8] flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--drop-ready-border)] bg-[var(--drop-ready-bg)]"
        aria-live="polite"
      >
        <div className="file-table__drop-overlay-card flex max-w-[520px] items-center gap-2.5 rounded-[10px] bg-[var(--overlay-card-bg)] px-[18px] py-[14px] shadow-[var(--overlay-card-shadow)]">
          <span className="file-table__drop-overlay-icon inline-flex items-center justify-center text-[var(--drop-icon-ready)]">
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
        className="file-table__container file-table__empty-wrap relative flex min-h-0"
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
          <div className="file-table__empty-center flex min-h-full w-full items-center justify-center">
            <div className="file-table__empty-state relative flex min-h-[180px] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-subtle)] p-5 text-center">
              <span
                className="file-table__empty-state-icon inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"
                aria-hidden="true"
              >
                <IconCloudUpload size={22} />
              </span>
              <Text size="sm" fw={700}>
                This folder is empty.
              </Text>
              <Text size="xs" c="dimmed" className="file-table__empty-state-hint max-w-[460px]">
                Import files up to {maxImportSizeLabel} each, {maxImportBatchSizeLabel} per import. Drag and drop files or folders here to upload.
              </Text>
              <Group gap="xs" className="file-table__empty-state-actions max-[980px]:w-full max-[980px]:flex-col">
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconBrandGoogleDrive size={14} />}
                  rightSection={
                    <Text size="xs" c="dimmed">
                      {importFromGoogleShortcutLabel}
                    </Text>
                  }
                  title={importFromGoogleLabelWithShortcut}
                  aria-label={importFromGoogleLabelWithShortcut}
                  onClick={onImportFromGoogle}
                  disabled={!onImportFromGoogle}
                  className="max-[980px]:w-full"
                >
                  Import from Google Drive
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconUpload size={14} />}
                  rightSection={
                    <Text size="xs" c="dimmed">
                      {uploadFromComputerShortcutLabel}
                    </Text>
                  }
                  title={uploadFromComputerLabelWithShortcut}
                  aria-label={uploadFromComputerLabelWithShortcut}
                  onClick={onImportFromComputer}
                  disabled={!onImportFromComputer}
                  loading={importFromComputerPending}
                  className="max-[980px]:w-full"
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
      ref={containerRef}
      className="file-table__container relative min-h-0"
      h="100%"
      onDragOver={readOnly ? undefined : (event) => onFolderDragOver(currentFolderId, event)}
      onDrop={readOnly ? undefined : (event) => onFolderDrop(currentFolderId, event)}
      onDragLeave={readOnly ? undefined : handleRootDragLeave}
      onPointerDown={dragSelection.onPointerDown}
      onPointerMove={dragSelection.onPointerMove}
      onPointerUp={dragSelection.onPointerUp}
      onPointerCancel={dragSelection.onPointerCancel}
      onClickCapture={dragSelection.onClickCapture}
    >
      <ScrollArea h="100%" scrollbars="y">
        <Table
          className={TABLE_CLASS_NAME}
          style={tableStyle}
          stickyHeader
          highlightOnHover
          withColumnBorders={false}
          styles={{
            th: {
              backgroundColor: 'var(--table-header-bg)',
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--table-separator)',
            },
          }}
        >
          <colgroup>
            <col className={SELECT_COLUMN_CLASS_NAME} />
            <col />
            {showTypeColumn ? <col className={TYPE_COLUMN_CLASS_NAME} /> : null}
            {showSizeColumn ? <col className={SIZE_COLUMN_CLASS_NAME} /> : null}
            {showUpdatedColumn ? <col className={UPDATED_COLUMN_CLASS_NAME} /> : null}
            {showActionsColumn ? <col className={ACTIONS_COLUMN_CLASS_NAME} /> : null}
          </colgroup>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className={`${TH_BASE_CLASS_NAME} ${SELECT_COLUMN_CLASS_NAME} file-table__th--select px-0 text-center`} w={44}>
                <span className="file-table__select-control flex min-h-full items-center justify-start pl-2">
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
                hidden={showBulkHeaderActions}
              />
              {showTypeColumn ? (
                <SortableHeader
                  label="Type"
                  active={sortBy === 'type'}
                  order={sortOrder}
                  onClick={() => onToggleSort('type')}
                  className={TYPE_COLUMN_CLASS_NAME}
                  hidden={showBulkHeaderActions}
                />
              ) : null}
              {showSizeColumn ? (
                <SortableHeader
                  label="Size"
                  active={sortBy === 'size'}
                  order={sortOrder}
                  onClick={() => onToggleSort('size')}
                  hidden={showBulkHeaderActions}
                  className={[SIZE_COLUMN_CLASS_NAME, showBulkHeaderActions ? 'file-table__th--bulk-hidden' : '']
                    .filter(Boolean)
                    .join(' ')}
                />
              ) : null}
              {showUpdatedColumn ? (
                <SortableHeader
                  label="Updated at"
                  active={sortBy === 'updated_at'}
                  order={sortOrder}
                  onClick={() => onToggleSort('updated_at')}
                  hidden={showBulkHeaderActions}
                  className={[UPDATED_COLUMN_CLASS_NAME, showBulkHeaderActions ? 'file-table__th--bulk-hidden' : '']
                    .filter(Boolean)
                    .join(' ')}
                />
              ) : null}
              {showActionsColumn ? (
                <Table.Th className={`${TH_BASE_CLASS_NAME} ${ACTIONS_COLUMN_CLASS_NAME} file-table__th--actions file-table__th--actions-anchor relative px-2 text-right`} w={56}>
                {showBulkHeaderActions ? (
                  <div className="file-table__bulk-header-overlay absolute right-2 top-1/2 z-[2] flex -translate-y-1/2 items-center gap-2.5 whitespace-nowrap">
                    {showBulkCountLabel ? (
                      <Text size="sm" fw={600} className="file-table__bulk-count whitespace-nowrap text-[var(--text-primary)]">
                        {selectedCount === 1 ? '1 item selected' : `${selectedCount} items selected`}
                      </Text>
                    ) : null}
                    <Group gap="xs" wrap="nowrap" className="file-table__bulk-actions ml-auto">
                      {showBulkButtonLabels ? (
                        <Button
                          variant="subtle"
                          size="xs"
                          leftSection={<IconX size={14} />}
                          onClick={onClearSelection}
                          aria-label={t('clearSelection')}
                          title={t('clearSelection')}
                          className="file-table__bulk-button [&_.mantine-Button-inner]:whitespace-nowrap"
                        >
                          <span className="file-table__bulk-button-label">{t('clearSelection')}</span>
                        </Button>
                      ) : (
                        <ActionIcon
                          variant="subtle"
                          size="lg"
                          onClick={onClearSelection}
                          aria-label={t('clearSelection')}
                          title={t('clearSelection')}
                          className="file-table__bulk-button !bg-transparent !text-[var(--text-secondary)] hover:!bg-[var(--bg-hover-soft)] hover:!text-[var(--text-primary)]"
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      )}
                      {showBulkButtonLabels ? (
                        <Button
                          variant="default"
                          size="xs"
                          leftSection={<IconDownload size={14} />}
                          onClick={onDownloadSelected}
                          loading={downloadPending}
                          aria-label={t('download')}
                          title={t('download')}
                          className="file-table__bulk-button [&_.mantine-Button-inner]:whitespace-nowrap"
                        >
                          <span className="file-table__bulk-button-label">{t('download')}</span>
                        </Button>
                      ) : (
                        <ActionIcon
                          variant="subtle"
                          size="lg"
                          onClick={onDownloadSelected}
                          loading={downloadPending}
                          aria-label={t('download')}
                          title={t('download')}
                          className="file-table__bulk-button !bg-transparent !text-[var(--text-secondary)] hover:!bg-[var(--bg-hover-soft)] hover:!text-[var(--text-primary)]"
                        >
                          <IconDownload size={14} />
                        </ActionIcon>
                      )}
                      {onCopySelected ? (
                        showBulkButtonLabels ? (
                          <Button
                            variant="default"
                            size="xs"
                            leftSection={<IconCopy size={14} />}
                            onClick={onCopySelected}
                            loading={copyPending}
                            aria-label={t('copy')}
                            title={t('copy')}
                            className="file-table__bulk-button [&_.mantine-Button-inner]:whitespace-nowrap"
                          >
                            <span className="file-table__bulk-button-label">{t('copy')}</span>
                          </Button>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            size="lg"
                            onClick={onCopySelected}
                            loading={copyPending}
                            aria-label={t('copy')}
                            title={t('copy')}
                            className="file-table__bulk-button !bg-transparent !text-[var(--text-secondary)] hover:!bg-[var(--bg-hover-soft)] hover:!text-[var(--text-primary)]"
                          >
                            <IconCopy size={14} />
                          </ActionIcon>
                        )
                      ) : null}
                      {onMoveSelected ? (
                        showBulkButtonLabels ? (
                          <Button
                            variant="default"
                            size="xs"
                            leftSection={<IconArrowsMove size={14} />}
                            onClick={onMoveSelected}
                            loading={movePending}
                            aria-label={t('move')}
                            title={t('move')}
                            className="file-table__bulk-button [&_.mantine-Button-inner]:whitespace-nowrap"
                          >
                            <span className="file-table__bulk-button-label">{t('move')}</span>
                          </Button>
                        ) : (
                          <ActionIcon
                            variant="subtle"
                            size="lg"
                            onClick={onMoveSelected}
                            loading={movePending}
                            aria-label={t('move')}
                            title={t('move')}
                            className="file-table__bulk-button !bg-transparent !text-[var(--text-secondary)] hover:!bg-[var(--bg-hover-soft)] hover:!text-[var(--text-primary)]"
                          >
                            <IconArrowsMove size={14} />
                          </ActionIcon>
                        )
                      ) : null}
                      {onDeleteSelected ? (
                        showBulkButtonLabels ? (
                          <Button
                            color="red"
                            variant="light"
                            size="xs"
                            leftSection={<IconTrash size={14} />}
                            onClick={onDeleteSelected}
                            loading={deletePending}
                            aria-label={t('deleteSelected')}
                            title={t('deleteSelected')}
                            className="file-table__bulk-button [&_.mantine-Button-inner]:whitespace-nowrap"
                          >
                            <span className="file-table__bulk-button-label">{t('deleteSelected')}</span>
                          </Button>
                        ) : (
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            size="lg"
                            onClick={onDeleteSelected}
                            loading={deletePending}
                            aria-label={t('deleteSelected')}
                            title={t('deleteSelected')}
                            className="file-table__bulk-button !bg-transparent !text-[var(--state-danger-text)] hover:!bg-[var(--state-danger-bg-soft)] hover:!text-[var(--state-danger-text)]"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        )
                      ) : null}
                    </Group>
                  </div>
                ) : null}
                </Table.Th>
              ) : null}
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody className="[&_tr:last-child_td]:border-b-0">
            {items.map((item) => {
              const isSelected = selectedIdSet.has(item.id)
              const isOpened = openedPreviewId === item.id
              const isFolder = !isFileItem(item)
              const dropState = !readOnly && isFolder ? getFolderDropState(item.id) : 'none'
              const isDragging = !readOnly && isDraggingItem(item.id)
              const fileTypePresentation = isFileItem(item)
                ? getFileTypePresentation(item.name, item.mimeType)
                : null

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
              const canDragRow = !readOnly && !isAreaSelectionModifierPressed

              return (
                <Table.Tr
                  key={item.id}
                  ref={(element) => {
                    if (element) {
                      rowRefs.current.set(item.id, element)
                      return
                    }
                    rowRefs.current.delete(item.id)
                  }}
                  data-item-id={item.id}
                  className="file-table__row group select-none [&_*]:select-none"
                  bg={rowBackground}
                  draggable={canDragRow}
                  onDragStart={
                    readOnly
                      ? undefined
                      : (event) => {
                          if (event.ctrlKey || event.metaKey) {
                            event.preventDefault()
                            return
                          }
                          onDragStartItem(item.id, event)
                        }
                  }
                  onDragEnd={readOnly ? undefined : onDragEnd}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setContextMenuState({
                      item,
                      x: event.clientX,
                      y: event.clientY,
                    })
                  }}
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
                  <Table.Td className={`${TD_BASE_CLASS_NAME} ${SELECT_COLUMN_CLASS_NAME} file-table__td--select px-0 py-0 text-center leading-none`}>
                    <span className="file-table__select-control flex min-h-full items-center justify-start pl-2">
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
                    className={`${TD_BASE_CLASS_NAME} file-table__td--name min-w-0 cursor-pointer`}
                    onClick={(event) => {
                      if (!readOnly && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault()
                        event.stopPropagation()
                        onToggleSelect(item.id, { keepExisting: true })
                        return
                      }

                      if (isFileItem(item)) {
                        onOpenFile(item.id)
                        return
                      }

                      onOpenFolder(item.id)
                    }}
                  >
                    <Group gap={8} wrap="nowrap" className="w-full min-w-0">
                      <span className="file-table__item-icon inline-flex h-4 w-4 min-w-4 flex-[0_0_16px] items-center justify-center" aria-hidden="true">
                        {isFileItem(item) ? (
                          <FileTypeIcon iconKey={fileTypePresentation?.iconKey ?? 'default'} size={16} />
                        ) : (
                          <IconFolder size={16} color="var(--accent)" />
                        )}
                      </span>
                      <div
                        className={[
                          'file-table__name-text min-w-0 flex-1 overflow-hidden whitespace-nowrap text-sm',
                          item.kind === 'folder' ? 'font-semibold' : 'font-medium',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        title={item.name}
                      >
                        <MiddleEllipsisText
                          text={item.name}
                          preserveExtension={isFileItem(item)}
                          className="w-full"
                        />
                      </div>
                    </Group>
                  </Table.Td>
                  {showTypeColumn ? (
                    <Table.Td className={`${TD_BASE_CLASS_NAME} ${TYPE_COLUMN_CLASS_NAME}`}>
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                        {item.kind === 'folder' ? `Folder(${item.fileCount} files)` : fileTypePresentation?.label}
                      </span>
                    </Table.Td>
                  ) : null}
                  {showSizeColumn ? (
                    <Table.Td className={`${TD_BASE_CLASS_NAME} file-table__td--size ${SIZE_COLUMN_CLASS_NAME} [font-variant-numeric:proportional-nums]`}>
                      {formatFileSize(item.sizeBytes)}
                    </Table.Td>
                  ) : null}
                  {showUpdatedColumn ? (
                    <Table.Td
                      className={[
                        TD_BASE_CLASS_NAME,
                        'file-table__td--updated',
                        UPDATED_COLUMN_CLASS_NAME,
                        '[font-variant-numeric:proportional-nums]',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={formatDate(item.updatedAt)}
                    >
                      {formatDate(item.updatedAt)}
                    </Table.Td>
                  ) : null}
                  {showActionsColumn ? (
                    <Table.Td className={`${TD_BASE_CLASS_NAME} ${ACTIONS_COLUMN_CLASS_NAME} file-table__td--actions px-2 text-right`}>
                    {readOnly ? (
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Download ${item.name}`}
                        onClick={() => onDownloadItem(item)}
                        className="ml-auto"
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                    ) : (
                      <Menu withinPortal position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${item.name}`} className="ml-auto">
                            <IconDotsVertical size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <ItemActionsMenuContent
                            item={item}
                            readOnly={readOnly}
                            onDownloadItem={onDownloadItem}
                            onCopyItem={onCopyItem}
                            onRenameItem={onRenameItem}
                            onMoveItem={onMoveItem}
                            onDeleteItem={onDeleteItem}
                            onShareItem={onShareItem}
                          />
                        </Menu.Dropdown>
                      </Menu>
                    )}
                    </Table.Td>
                  ) : null}
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {dragSelection.isSelecting ? (
        <div
          ref={selectionOverlayRef}
          className="file-table__selection-rect pointer-events-none absolute z-[6] rounded border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
          aria-hidden="true"
        />
      ) : null}
      {renderImportOverlay()}
      {renderMoveOverlay()}
      <Menu
        opened={Boolean(contextMenuState && contextMenuItem)}
        onChange={(opened) => {
          if (!opened) {
            setContextMenuState(null)
          }
        }}
        withinPortal
        position="bottom-start"
      >
        <Menu.Target>
          <Box
            style={{
              position: 'fixed',
              left: contextMenuState?.x ?? -9999,
              top: contextMenuState?.y ?? -9999,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </Menu.Target>
        <Menu.Dropdown onContextMenu={(event) => event.preventDefault()}>
          {contextMenuItem ? (
            <ItemActionsMenuContent
              item={contextMenuItem}
              readOnly={readOnly}
              onDownloadItem={onDownloadItem}
              onCopyItem={onCopyItem}
              onRenameItem={onRenameItem}
              onMoveItem={onMoveItem}
              onDeleteItem={onDeleteItem}
              onShareItem={onShareItem}
              onAction={() => setContextMenuState(null)}
            />
          ) : null}
        </Menu.Dropdown>
      </Menu>
    </Box>
  )
}
