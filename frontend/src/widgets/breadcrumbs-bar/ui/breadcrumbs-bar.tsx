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
import type { DragEvent } from 'react'

import type { Breadcrumb } from '@/entities/folder'
import { APP_SHORTCUTS } from '@/shared/lib/keyboard/shortcuts'
import { Group, Menu, Text } from '@/shared/ui'
import './breadcrumbs-bar.css'

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

const COLLAPSE_THRESHOLD = 5
const NOOP_FOLDER_DRAG_OVER = (): void => {}
const NOOP_FOLDER_DRAG_LEAVE = (): void => {}
const NOOP_FOLDER_DROP = (): void => {}
const NOOP_DROP_STATE = (): DropState => 'none'

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
  const shouldCollapse = breadcrumbs.length >= COLLAPSE_THRESHOLD
  const start = breadcrumbs[0]
  const end = shouldCollapse ? breadcrumbs.slice(-2) : breadcrumbs.slice(1)
  const hidden = shouldCollapse ? breadcrumbs.slice(1, -2) : []
  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1]
  const hasCurrentFolderMenu =
    Boolean(currentFolderMenu) &&
    Boolean(currentBreadcrumb) &&
    currentBreadcrumb.id !== 'root' &&
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
      return 'breadcrumbs-bar__item--drop-valid'
    }
    if (dropState === 'warning') {
      return 'breadcrumbs-bar__item--drop-warning'
    }
    if (dropState === 'invalid') {
      return 'breadcrumbs-bar__item--drop-invalid'
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

  const renderCurrentFolderMenu = (crumb: Breadcrumb) => {
    if (!hasCurrentFolderMenu || !currentFolderMenu || currentBreadcrumb?.id !== crumb.id) {
      return null
    }

    const hasPrimaryActions = Boolean(currentFolderMenu.onCreateFolder || currentFolderMenu.onRename)
    const hasMiddleActions = Boolean(
      currentFolderMenu.onShare || currentFolderMenu.onDownload || currentFolderMenu.onCopy || currentFolderMenu.onMove,
    )
    const hasDeleteAction = Boolean(currentFolderMenu.onDelete)

    return (
      <Menu withinPortal position="bottom-start">
        <Menu.Target>
          <button
            type="button"
            className="breadcrumbs-bar__current-menu-target"
            aria-label={`Actions for ${crumb.name}`}
          >
            <IconChevronDown size={14} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          {currentFolderMenu.onCreateFolder ? (
            <Menu.Item
              leftSection={<IconFolderPlus size={14} />}
              rightSection={<Text size="xs" c="dimmed">{createFolderShortcutLabel}</Text>}
              onClick={() => currentFolderMenu.onCreateFolder?.(crumb)}
            >
              Create folder
            </Menu.Item>
          ) : null}
          {currentFolderMenu.onRename ? (
            <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => currentFolderMenu.onRename?.(crumb)}>
              Rename
            </Menu.Item>
          ) : null}
          {hasPrimaryActions && (hasMiddleActions || hasDeleteAction) ? <Menu.Divider /> : null}
          {currentFolderMenu.onShare ? (
            <Menu.Item leftSection={<IconLink size={14} />} onClick={() => currentFolderMenu.onShare?.(crumb)}>
              Share
            </Menu.Item>
          ) : null}
          {currentFolderMenu.onDownload ? (
            <Menu.Item leftSection={<IconDownload size={14} />} onClick={() => currentFolderMenu.onDownload?.(crumb)}>
              Download
            </Menu.Item>
          ) : null}
          {currentFolderMenu.onCopy ? (
            <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => currentFolderMenu.onCopy?.(crumb)}>
              Copy
            </Menu.Item>
          ) : null}
          {currentFolderMenu.onMove ? (
            <Menu.Item leftSection={<IconArrowsMove size={14} />} onClick={() => currentFolderMenu.onMove?.(crumb)}>
              Move
            </Menu.Item>
          ) : null}
          {hasMiddleActions && hasDeleteAction ? <Menu.Divider /> : null}
          {currentFolderMenu.onDelete ? (
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => currentFolderMenu.onDelete?.(crumb)}
            >
              Delete
            </Menu.Item>
          ) : null}
        </Menu.Dropdown>
      </Menu>
    )
  }

  return (
    <Group className="breadcrumbs-bar" px={compact ? 0 : 'md'} py={compact ? 0 : 'xs'} gap={6} wrap="nowrap">
      {start ? (
        <Group gap={2} wrap="nowrap">
          <button
            type="button"
            className={['breadcrumbs-bar__item', 'breadcrumbs-bar__item--root', getDropClassName(start.id)]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onNavigate(start.id)}
            onDragOver={(event) => onFolderDragOver(start.id, event)}
            onDrop={(event) => onFolderDrop(start.id, event)}
            onDragLeave={(event) => handleDragLeave(start.id, event)}
          >
            {showHomeIcon ? (
              <span className="breadcrumbs-bar__home-icon" aria-hidden="true">
                <IconHome2 size={14} />
              </span>
            ) : null}
            <span className="breadcrumbs-bar__label">{start.name}</span>
          </button>
          {renderCurrentFolderMenu(start)}
        </Group>
      ) : null}

      {shouldCollapse ? (
        <>
          <IconChevronRight size={14} className="breadcrumbs-bar__separator-icon" />
          <Menu withinPortal>
            <Menu.Target>
              <button type="button" className="breadcrumbs-bar__menu-target" aria-label="Show hidden folders">
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
          <IconChevronRight size={14} className="breadcrumbs-bar__separator-icon" />
          <Group gap={2} wrap="nowrap">
            <button
              type="button"
              className={['breadcrumbs-bar__item', getDropClassName(crumb.id)].filter(Boolean).join(' ')}
              onClick={() => onNavigate(crumb.id)}
              onDragOver={(event) => onFolderDragOver(crumb.id, event)}
              onDrop={(event) => onFolderDrop(crumb.id, event)}
              onDragLeave={(event) => handleDragLeave(crumb.id, event)}
            >
              <span className="breadcrumbs-bar__label">{crumb.name}</span>
            </button>
            {renderCurrentFolderMenu(crumb)}
          </Group>
        </Group>
      ))}
    </Group>
  )
}
