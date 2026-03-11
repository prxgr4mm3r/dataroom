import {
  IconArrowsMove,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconDots,
  IconDownload,
  IconEdit,
  IconFolderPlus,
  IconHome2,
  IconLink,
  IconTrash,
} from '@tabler/icons-react'
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useEffect, useState } from 'react'

import type { Breadcrumb } from '@/entities/folder'
import { APP_SHORTCUTS } from '@/shared/lib/keyboard/shortcuts'
import { Box, Group, Menu, Text } from '@/shared/ui'

type DropState = 'none' | 'valid' | 'warning' | 'invalid'

type CurrentFolderMenuHandlers = {
  onCreateFolder?: (folder: Breadcrumb) => void
  onDownload?: (folder: Breadcrumb) => void
  onCopy?: (folder: Breadcrumb) => void
  onShare?: (folder: Breadcrumb) => void
  onRename?: (folder: Breadcrumb) => void
  onMove?: (folder: Breadcrumb) => void
  onDelete?: (folder: Breadcrumb) => void
}

type BreadcrumbsBarProps = {
  breadcrumbs: Breadcrumb[]
  onNavigate: (folderId: string) => void
  compact?: boolean
  currentFolderMenu?: CurrentFolderMenuHandlers
  onFolderDragOver?: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave?: (folderId: string) => void
  onFolderDrop?: (folderId: string, event: DragEvent<HTMLElement>) => void
  getFolderDropState?: (folderId: string) => DropState
}

type ContextMenuState = {
  crumb: Breadcrumb
  x: number
  y: number
}

const COLLAPSE_THRESHOLD = 5
const NOOP_FOLDER_DRAG_OVER = (): void => {}
const NOOP_FOLDER_DRAG_LEAVE = (): void => {}
const NOOP_FOLDER_DROP = (): void => {}
const NOOP_DROP_STATE = (): DropState => 'none'
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
const BREADCRUMB_ITEM_CLASS_NAME =
  'inline-flex max-w-[min(42vw,280px)] cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2.5 py-[5px] font-inherit text-[var(--text-secondary)] transition-colors duration-[120ms] ease-[ease] hover:bg-[var(--bg-hover-soft)] hover:text-[var(--text-primary)] focus-visible:bg-[var(--accent-soft)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none'
const BREADCRUMB_MENU_BUTTON_CLASS_NAME =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[var(--icon-strong)] transition-colors duration-[120ms] ease-[ease] hover:bg-[var(--bg-hover-soft)] hover:text-[var(--text-primary)] focus-visible:bg-[var(--accent-soft)] focus-visible:text-[var(--text-primary)] focus-visible:outline-none'

export const BreadcrumbsBar = ({
  breadcrumbs,
  onNavigate,
  compact = false,
  currentFolderMenu,
  onFolderDragOver = NOOP_FOLDER_DRAG_OVER,
  onFolderDragLeave = NOOP_FOLDER_DRAG_LEAVE,
  onFolderDrop = NOOP_FOLDER_DROP,
  getFolderDropState = NOOP_DROP_STATE,
}: BreadcrumbsBarProps) => {
  const createFolderShortcutLabel = APP_SHORTCUTS.createFolder.compactLabel
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null)
  const shouldCollapse = breadcrumbs.length >= COLLAPSE_THRESHOLD
  const start = breadcrumbs[0]
  const end = shouldCollapse ? breadcrumbs.slice(-2) : breadcrumbs.slice(1)
  const hidden = shouldCollapse ? breadcrumbs.slice(1, -2) : []
  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1]
  const hasFolderMenuActions =
    Boolean(currentFolderMenu) &&
    Boolean(
      currentFolderMenu?.onCreateFolder ||
        currentFolderMenu?.onRename ||
        currentFolderMenu?.onShare ||
        currentFolderMenu?.onDownload ||
        currentFolderMenu?.onCopy ||
        currentFolderMenu?.onMove ||
        currentFolderMenu?.onDelete,
    )
  const showHomeIcon = start?.id === 'root'
  const getDropClassName = (folderId: string): string => {
    const dropState = getFolderDropState(folderId)
    if (dropState === 'valid') {
      return '!bg-[var(--state-success-bg-soft)] !text-[var(--state-success-text)] hover:!bg-[var(--state-success-bg-soft)] hover:!text-[var(--state-success-text)]'
    }
    if (dropState === 'warning') {
      return '!bg-[var(--state-warning-bg-soft)] !text-[var(--state-warning-text)] hover:!bg-[var(--state-warning-bg-soft)] hover:!text-[var(--state-warning-text)]'
    }
    if (dropState === 'invalid') {
      return '!bg-[var(--state-danger-bg-soft)] !text-[var(--state-danger-text)] hover:!bg-[var(--state-danger-bg-soft)] hover:!text-[var(--state-danger-text)]'
    }
    return ''
  }

  const handleDragLeave = (folderId: string, event: DragEvent<HTMLButtonElement>) => {
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }
    onFolderDragLeave(folderId)
  }

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

  const runFolderAction = (handler: ((folder: Breadcrumb) => void) | undefined, crumb: Breadcrumb, onAction?: () => void) => {
    return () => {
      onAction?.()
      handler?.(crumb)
    }
  }

  const renderFolderMenuContent = (crumb: Breadcrumb, onAction?: () => void) => {
    if (!hasFolderMenuActions || !currentFolderMenu) {
      return null
    }

    const isRootCrumb = crumb.id === 'root'
    const onCreateFolder = currentFolderMenu.onCreateFolder
    const onRename = isRootCrumb ? undefined : currentFolderMenu.onRename
    const onShare = currentFolderMenu.onShare
    const onDownload = currentFolderMenu.onDownload
    const onCopy = isRootCrumb ? undefined : currentFolderMenu.onCopy
    const onMove = isRootCrumb ? undefined : currentFolderMenu.onMove
    const onDelete = isRootCrumb ? undefined : currentFolderMenu.onDelete

    const hasPrimaryActions = Boolean(onCreateFolder || onRename)
    const hasMiddleActions = Boolean(onShare || onDownload || onCopy || onMove)
    const hasDeleteAction = Boolean(onDelete)

    return (
      <>
        {onCreateFolder ? (
          <Menu.Item
            leftSection={<IconFolderPlus size={14} />}
            rightSection={<Text size="xs" c="dimmed">{createFolderShortcutLabel}</Text>}
            onClick={runFolderAction(onCreateFolder, crumb, onAction)}
          >
            Create folder
          </Menu.Item>
        ) : null}
        {onRename ? (
          <Menu.Item leftSection={<IconEdit size={14} />} onClick={runFolderAction(onRename, crumb, onAction)}>
            Rename
          </Menu.Item>
        ) : null}
        {hasPrimaryActions && (hasMiddleActions || hasDeleteAction) ? <Menu.Divider /> : null}
        {onShare ? (
          <Menu.Item leftSection={<IconLink size={14} />} onClick={runFolderAction(onShare, crumb, onAction)}>
            Share
          </Menu.Item>
        ) : null}
        {onDownload ? (
          <Menu.Item
            leftSection={<IconDownload size={14} />}
            onClick={runFolderAction(onDownload, crumb, onAction)}
          >
            Download
          </Menu.Item>
        ) : null}
        {onCopy ? (
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={runFolderAction(onCopy, crumb, onAction)}>
            Copy
          </Menu.Item>
        ) : null}
        {onMove ? (
          <Menu.Item
            leftSection={<IconArrowsMove size={14} />}
            onClick={runFolderAction(onMove, crumb, onAction)}
          >
            Move
          </Menu.Item>
        ) : null}
        {hasMiddleActions && hasDeleteAction ? <Menu.Divider /> : null}
        {onDelete ? (
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={runFolderAction(onDelete, crumb, onAction)}
          >
            Delete
          </Menu.Item>
        ) : null}
      </>
    )
  }

  const handleBreadcrumbContextMenu = (crumb: Breadcrumb, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!hasFolderMenuActions) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setContextMenuState({
      crumb,
      x: event.clientX,
      y: event.clientY,
    })
  }

  const renderCurrentFolderMenu = (crumb: Breadcrumb) => {
    if (!hasFolderMenuActions || currentBreadcrumb?.id !== crumb.id) {
      return null
    }

    return (
      <Menu withinPortal position="bottom-start">
        <Menu.Target>
          <button
            type="button"
            className={BREADCRUMB_MENU_BUTTON_CLASS_NAME}
            aria-label={`Actions for ${crumb.name}`}
          >
            <IconChevronDown size={14} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>{renderFolderMenuContent(crumb)}</Menu.Dropdown>
      </Menu>
    )
  }

  return (
    <Group className="min-w-0" px={compact ? 0 : 'md'} py={compact ? 0 : 'xs'} gap={6} wrap="nowrap">
      {start ? (
        <Group gap={2} wrap="nowrap">
          <button
            type="button"
            className={cx(
              BREADCRUMB_ITEM_CLASS_NAME,
              'font-semibold text-[var(--text-primary)]',
              getDropClassName(start.id),
            )}
            onClick={() => onNavigate(start.id)}
            onDragOver={(event) => onFolderDragOver(start.id, event)}
            onDrop={(event) => onFolderDrop(start.id, event)}
            onDragLeave={(event) => handleDragLeave(start.id, event)}
            onContextMenu={hasFolderMenuActions ? (event) => handleBreadcrumbContextMenu(start, event) : undefined}
          >
            {showHomeIcon ? (
              <span className="inline-flex shrink-0 items-center justify-center text-[var(--accent)]" aria-hidden="true">
                <IconHome2 size={14} />
              </span>
            ) : null}
            <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-[1.25]">
              {start.name}
            </span>
          </button>
          {renderCurrentFolderMenu(start)}
        </Group>
      ) : null}

      {shouldCollapse ? (
        <>
          <IconChevronRight size={14} className="shrink-0 text-[var(--text-muted)]" />
          <Menu withinPortal>
            <Menu.Target>
              <button type="button" className={BREADCRUMB_MENU_BUTTON_CLASS_NAME} aria-label="Show hidden folders">
                <IconDots size={16} />
              </button>
            </Menu.Target>
            <Menu.Dropdown>
              {hidden.map((crumb) => (
                <Menu.Item key={crumb.id} onClick={() => onNavigate(crumb.id)}>
                  {crumb.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </>
      ) : null}

      {end.map((crumb) => (
        <Group gap={6} key={crumb.id} wrap="nowrap">
          <IconChevronRight size={14} className="shrink-0 text-[var(--text-muted)]" />
          <Group gap={2} wrap="nowrap">
            <button
              type="button"
              className={cx(BREADCRUMB_ITEM_CLASS_NAME, getDropClassName(crumb.id))}
              onClick={() => onNavigate(crumb.id)}
              onDragOver={(event) => onFolderDragOver(crumb.id, event)}
              onDrop={(event) => onFolderDrop(crumb.id, event)}
              onDragLeave={(event) => handleDragLeave(crumb.id, event)}
              onContextMenu={hasFolderMenuActions ? (event) => handleBreadcrumbContextMenu(crumb, event) : undefined}
            >
              <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-[1.25]">
                {crumb.name}
              </span>
            </button>
            {renderCurrentFolderMenu(crumb)}
          </Group>
        </Group>
      ))}
      <Menu
        opened={Boolean(contextMenuState && hasFolderMenuActions)}
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
          {contextMenuState ? renderFolderMenuContent(contextMenuState.crumb, () => setContextMenuState(null)) : null}
        </Menu.Dropdown>
      </Menu>
    </Group>
  )
}
