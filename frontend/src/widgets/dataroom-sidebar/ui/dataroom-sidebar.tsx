import {
  IconArrowsMove,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconDownload,
  IconDotsVertical,
  IconEdit,
  IconFolder,
  IconLink,
  IconLogout,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import type { CSSProperties, DragEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useEffect, useState } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { isFileItem } from '@/entities/content-item'
import type { FolderNode } from '@/entities/folder'
import type { UserProfile } from '@/entities/user'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { t } from '@/shared/i18n/messages'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { splitFileName } from '@/shared/lib/file/split-file-name'
import { APP_SHORTCUTS, withShortcutHint } from '@/shared/lib/keyboard/shortcuts'
import { normalizeFolderId } from '@/shared/routes/dataroom-routes'
import { ActionIcon, Box, Button, FileTypeIcon, Group, Menu, ScrollArea, Text, Title, Tooltip } from '@/shared/ui'
import { ImportSourceMenu } from '@/widgets/import-source-menu'
import './dataroom-sidebar.css'

type DropState = 'none' | 'valid' | 'warning' | 'invalid'

type DataroomSidebarProps = {
  currentUser: UserProfile
  folderTree: FolderNode | undefined
  activeFolderId: string
  activePreviewId: string | null
  expandedIds: Set<string>
  fileContentVisibleFolderIds: Set<string>
  onNewFolder: () => void
  onImportFromGoogle: () => void
  onImportFromComputer: () => void
  onToggleExpanded: (folderId: string) => void
  onSetFileContentVisibility: (folderId: string, visible: boolean) => void
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string) => void
  onSignOut: () => void
  onDownloadItem: (item: ContentItem) => void
  onCopyItem?: (item: ContentItem) => void
  onRenameItem?: (item: ContentItem) => void
  onMoveItem?: (item: ContentItem) => void
  onDeleteItem?: (item: ContentItem) => void
  onShareItem?: (item: ContentItem) => void
  onRootCreateFolder?: () => void
  onRootDownload?: () => void
  onRootShare?: () => void
  onDragStartItem: (item: ContentItem, event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave: (folderId: string) => void
  getFolderDropState: (folderId: string) => DropState
  isDraggingItem: (itemId: string) => boolean
  getFolderItem: (folderId: string) => ContentItem | null
}

type FolderChildrenProps = {
  folderNode: FolderNode
  parentFolderId: string | null
  depth: number
  highlightBranch?: boolean
  expandedIds: Set<string>
  fileContentVisibleFolderIds: Set<string>
  activeFolderId: string
  activePreviewId: string | null
  onToggleExpanded: (folderId: string) => void
  onSetFileContentVisibility: (folderId: string, visible: boolean) => void
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string) => void
  onDownloadItem: (item: ContentItem) => void
  onCopyItem?: (item: ContentItem) => void
  onRenameItem?: (item: ContentItem) => void
  onMoveItem?: (item: ContentItem) => void
  onDeleteItem?: (item: ContentItem) => void
  onShareItem?: (item: ContentItem) => void
  onDragStartItem: (item: ContentItem, event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave: (folderId: string) => void
  getFolderDropState: (folderId: string) => DropState
  isDraggingItem: (itemId: string) => boolean
  getFolderItem: (folderId: string) => ContentItem | null
  onItemContextMenu: (item: ContentItem, event: ReactMouseEvent<HTMLElement>) => void
}

type ActiveVariant = 'solid' | 'file' | 'context'

type DataroomSidebarRailProps = {
  currentUser: UserProfile
  onNewFolder: () => void
  onImportFromGoogle: () => void
  onImportFromComputer: () => void
  onSignOut: () => void
}

const TREE_INDENT_STEP = 20

type SidebarContextMenuState =
  | {
      kind: 'item'
      item: ContentItem
      x: number
      y: number
    }
  | {
      kind: 'root'
      x: number
      y: number
    }

type SidebarItemActionsMenuContentProps = {
  item: ContentItem
  onDownloadItem: (item: ContentItem) => void
  onCopyItem?: (item: ContentItem) => void
  onRenameItem?: (item: ContentItem) => void
  onMoveItem?: (item: ContentItem) => void
  onDeleteItem?: (item: ContentItem) => void
  onShareItem?: (item: ContentItem) => void
  onAction?: () => void
}

type SidebarRootActionsMenuContentProps = {
  onCreateFolder?: () => void
  onDownload?: () => void
  onShare?: () => void
  onAction?: () => void
}

const SidebarItemActionsMenuContent = ({
  item,
  onDownloadItem,
  onCopyItem,
  onRenameItem,
  onMoveItem,
  onDeleteItem,
  onShareItem,
  onAction,
}: SidebarItemActionsMenuContentProps) => {
  const runAction = (handler: (item: ContentItem) => void): (() => void) => {
    return () => {
      onAction?.()
      handler(item)
    }
  }
  const hasPrimaryMenuActions = Boolean(onRenameItem)
  const hasSecondaryMenuActions = Boolean(onShareItem || onDownloadItem || onCopyItem || onMoveItem)
  const hasDeleteMenuAction = Boolean(onDeleteItem)

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

const SidebarRootActionsMenuContent = ({
  onCreateFolder,
  onDownload,
  onShare,
  onAction,
}: SidebarRootActionsMenuContentProps) => {
  const runAction = (handler: () => void): (() => void) => {
    return () => {
      onAction?.()
      handler()
    }
  }
  const hasPrimaryActions = Boolean(onCreateFolder)
  const hasMiddleActions = Boolean(onShare || onDownload)

  return (
    <>
      {onCreateFolder ? (
        <Menu.Item leftSection={<IconPlus size={14} />} onClick={runAction(onCreateFolder)}>
          Create folder
        </Menu.Item>
      ) : null}
      {hasPrimaryActions && hasMiddleActions ? <Menu.Divider /> : null}
      {onShare ? (
        <Menu.Item leftSection={<IconLink size={14} />} onClick={runAction(onShare)}>
          Share
        </Menu.Item>
      ) : null}
      {onDownload ? (
        <Menu.Item leftSection={<IconDownload size={14} />} onClick={runAction(onDownload)}>
          Download
        </Menu.Item>
      ) : null}
    </>
  )
}

const toInitials = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return '??'
  }

  const parts = trimmed.split(/[\s._@-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) ?? ''
  const initials = `${first}${second}`.toUpperCase()

  return initials.length === 2 ? initials : `${initials}${initials ? '?' : '??'}`.slice(0, 2)
}

const AVATAR_COLORS = ['#5b6fe8', '#2f9e44', '#0f766e', '#7a5af8', '#c2410c', '#b54708', '#2563eb', '#4f46e5']
const AVATAR_CACHE_PREFIX = 'dataroom:avatar:'
const AVATAR_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14
const AVATAR_CACHE_MAX_BYTES = 128 * 1024

type AvatarCacheRecord = {
  dataUrl: string
  photoUrl: string
  updatedAt: number
}

const pickAvatarColor = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const getAvatarCacheKey = (cacheId: string): string => `${AVATAR_CACHE_PREFIX}${cacheId}`

const readCachedAvatar = (cacheId: string): AvatarCacheRecord | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(getAvatarCacheKey(cacheId))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<AvatarCacheRecord>
    if (typeof parsed.dataUrl !== 'string' || typeof parsed.photoUrl !== 'string' || typeof parsed.updatedAt !== 'number') {
      window.localStorage.removeItem(getAvatarCacheKey(cacheId))
      return null
    }

    if (Date.now() - parsed.updatedAt > AVATAR_CACHE_TTL_MS) {
      window.localStorage.removeItem(getAvatarCacheKey(cacheId))
      return null
    }

    return {
      dataUrl: parsed.dataUrl,
      photoUrl: parsed.photoUrl,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

const writeCachedAvatar = (cacheId: string, payload: AvatarCacheRecord): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(getAvatarCacheKey(cacheId), JSON.stringify(payload))
  } catch {
    // Ignore storage quota/privacy mode errors and keep runtime behavior unchanged.
  }
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Avatar cache read failed'))
    }

    reader.onerror = () => reject(reader.error ?? new Error('Avatar cache read failed'))
    reader.readAsDataURL(blob)
  })

const cacheAvatarFromNetwork = async (cacheId: string, photoUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(photoUrl, { cache: 'force-cache' })
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    if (!blob.type.startsWith('image/') || blob.size > AVATAR_CACHE_MAX_BYTES) {
      return null
    }

    const dataUrl = await blobToDataUrl(blob)
    writeCachedAvatar(cacheId, {
      dataUrl,
      photoUrl,
      updatedAt: Date.now(),
    })
    return dataUrl
  } catch {
    return null
  }
}

const useCachedAvatarImage = ({
  cacheId,
  photoUrl,
}: {
  cacheId: string
  photoUrl: string | null
}) => {
  const avatarIdentity = `${cacheId}:${photoUrl ?? ''}`
  const initialCacheRecord = photoUrl ? readCachedAvatar(cacheId) : null
  const [cacheState, setCacheState] = useState(() => {
    return {
      avatarIdentity,
      cachedDataUrl: initialCacheRecord?.dataUrl ?? null,
      cachedPhotoUrl: initialCacheRecord?.photoUrl ?? null,
    }
  })
  const normalizedCacheState =
    cacheState.avatarIdentity === avatarIdentity
      ? cacheState
      : {
          avatarIdentity,
          cachedDataUrl: initialCacheRecord?.dataUrl ?? null,
          cachedPhotoUrl: initialCacheRecord?.photoUrl ?? null,
        }
  const cachedDataUrl = normalizedCacheState.cachedDataUrl
  const [attemptState, setAttemptState] = useState(() => {
    return {
      avatarIdentity,
      useCachedAvatar: false,
      avatarLoadFailed: false,
    }
  })
  const normalizedAttemptState =
    attemptState.avatarIdentity === avatarIdentity
      ? attemptState
      : {
          avatarIdentity,
          useCachedAvatar: false,
          avatarLoadFailed: false,
        }
  const avatarSrc = normalizedAttemptState.useCachedAvatar ? cachedDataUrl : photoUrl
  const showPhotoAvatar = Boolean(avatarSrc) && !normalizedAttemptState.avatarLoadFailed

  const handleAvatarError = () => {
    setAttemptState((prev) => {
      const current =
        prev.avatarIdentity === avatarIdentity
          ? prev
          : {
              avatarIdentity,
              useCachedAvatar: false,
              avatarLoadFailed: false,
            }

      if (!current.useCachedAvatar && cachedDataUrl) {
        return {
          ...current,
          useCachedAvatar: true,
        }
      }

      return {
        ...current,
        avatarLoadFailed: true,
      }
    })
  }

  const handleAvatarLoad = () => {
    if (!photoUrl || normalizedAttemptState.useCachedAvatar) {
      return
    }

    if (normalizedCacheState.cachedPhotoUrl === photoUrl) {
      return
    }

    void cacheAvatarFromNetwork(cacheId, photoUrl).then((dataUrl) => {
      if (dataUrl) {
        setCacheState({
          avatarIdentity,
          cachedDataUrl: dataUrl,
          cachedPhotoUrl: photoUrl,
        })
      }
    })
  }

  return {
    avatarSrc: showPhotoAvatar ? avatarSrc : null,
    showPhotoAvatar,
    handleAvatarError,
    handleAvatarLoad,
  }
}

export const DataroomSidebarRail = ({
  currentUser,
  onNewFolder,
  onImportFromGoogle,
  onImportFromComputer,
  onSignOut,
}: DataroomSidebarRailProps) => {
  const accountName = currentUser.displayName || currentUser.email || currentUser.firebaseUid
  const accountInitials = toInitials(accountName)
  const avatarColor = pickAvatarColor(currentUser.id || currentUser.firebaseUid || accountName)
  const avatarCacheId = currentUser.id || currentUser.firebaseUid || accountName
  const createLabel = t('create')
  const { avatarSrc, showPhotoAvatar, handleAvatarError, handleAvatarLoad } = useCachedAvatarImage({
    cacheId: avatarCacheId,
    photoUrl: currentUser.photoUrl,
  })

  return (
    <Box className="dataroom-sidebar-rail">
      <Group className="dataroom-sidebar-rail__actions" gap={4}>
        <ImportSourceMenu
          onNewFolder={onNewFolder}
          onImportFromGoogle={onImportFromGoogle}
          onImportFromComputer={onImportFromComputer}
          position="right-start"
          offset={8}
        >
          <Box>
            <Tooltip label={createLabel} position="right">
              <ActionIcon
                className="dataroom-sidebar-rail__action-icon"
                variant="subtle"
                size="lg"
                radius="md"
                aria-label={createLabel}
                title={createLabel}
              >
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        </ImportSourceMenu>
      </Group>

      <Menu withinPortal position="right-end" offset={10}>
        <Menu.Target>
          <Box component="button" type="button" className="dataroom-sidebar-rail__account" aria-label={accountName}>
            <Box
              className="dataroom-sidebar-rail__avatar"
              style={!showPhotoAvatar ? { backgroundColor: avatarColor } : undefined}
            >
              {showPhotoAvatar ? (
                <img
                  src={avatarSrc ?? undefined}
                  alt={accountName}
                  className="dataroom-sidebar-rail__avatar-image"
                  onError={handleAvatarError}
                  onLoad={handleAvatarLoad}
                />
              ) : (
                <span className="dataroom-sidebar-rail__avatar-fallback">{accountInitials}</span>
              )}
            </Box>
          </Box>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{accountName}</Menu.Label>
          <Menu.Item leftSection={<IconLogout size={14} />} onClick={onSignOut}>
            {t('signOut')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Box>
  )
}

const handleFolderRowClick = ({
  folderId,
  canExpand,
  isActive,
  onOpenFolder,
  onToggleExpanded,
}: {
  folderId: string
  canExpand: boolean
  isActive: boolean
  onOpenFolder: (folderId: string) => void
  onToggleExpanded: () => void
}) => {
  onOpenFolder(folderId)

  if (!canExpand) {
    return
  }

  if (isActive) {
    onToggleExpanded()
  }
}

const TreeRow = ({
  depth,
  active,
  activeVariant = 'solid',
  isFile,
  name,
  mimeType,
  onClick,
  expanded,
  canExpand,
  onToggle,
  dropState,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragLeave,
  onContextMenu,
}: {
  depth: number
  active: boolean
  activeVariant?: ActiveVariant
  isFile: boolean
  name: string
  mimeType?: string | null
  onClick: () => void
  expanded?: boolean
  canExpand?: boolean
  onToggle?: () => void
  dropState?: DropState
  draggable?: boolean
  isDragging?: boolean
  onDragStart?: (event: DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
  onDragOver?: (event: DragEvent<HTMLElement>) => void
  onDrop?: (event: DragEvent<HTMLElement>) => void
  onDragLeave?: (event: DragEvent<HTMLElement>) => void
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void
}) => {
  const nameParts = isFile
    ? splitFileName(name)
    : {
        base: name,
        extension: '',
      }
  const fileTypePresentation = isFile ? getFileTypePresentation(name, mimeType) : null

  const dropClass =
    dropState === 'valid'
      ? 'sidebar-tree-row--drop-valid'
      : dropState === 'warning'
        ? 'sidebar-tree-row--drop-warning'
      : dropState === 'invalid'
        ? 'sidebar-tree-row--drop-invalid'
        : ''

  const className = [
    'sidebar-tree-row',
    active && activeVariant === 'solid' ? 'sidebar-tree-row--active-solid' : '',
    active && activeVariant === 'file' ? 'sidebar-tree-row--active-file' : '',
    active && activeVariant === 'context' ? 'sidebar-tree-row--active-context' : '',
    isDragging ? 'sidebar-tree-row--dragging' : '',
    dropClass,
  ]
    .filter(Boolean)
    .join(' ')

  const labelColor = !active ? 'var(--text-primary)' : activeVariant === 'context' ? 'var(--text-secondary)' : 'var(--accent)'

  return (
    <Box
      component="button"
      type="button"
      className={className}
      style={{ '--sidebar-tree-indent': `${depth * TREE_INDENT_STEP}px` } as CSSProperties}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onContextMenu={onContextMenu}
    >
      <Group gap={8} px="sm" py={6} wrap="nowrap">
        {canExpand ? (
          <Box
            className="sidebar-tree-row__expander"
            onClick={(event) => {
              event.stopPropagation()
              onToggle?.()
            }}
          >
            {expanded ? (
              <IconChevronDown size={14} color="var(--text-muted)" />
            ) : (
              <IconChevronRight size={14} color="var(--text-muted)" />
            )}
          </Box>
        ) : null}

        <Box className="sidebar-tree-row__icon">
          {isFile ? (
            <FileTypeIcon iconKey={fileTypePresentation?.iconKey ?? 'default'} size={16} />
          ) : (
            <IconFolder size={16} color="var(--accent)" />
          )}
        </Box>

        <Text
          className="sidebar-tree-row__label"
          size="sm"
          fw={active ? 600 : 500}
          c={labelColor}
          title={name}
        >
          <span className="sidebar-tree-row__name-base">{nameParts.base}</span>
          {nameParts.extension ? <span className="sidebar-tree-row__name-ext">{nameParts.extension}</span> : null}
        </Text>
      </Group>
    </Box>
  )
}

const SYNTHETIC_FOLDER_TIMESTAMP = '1970-01-01T00:00:00.000Z'

const createFallbackFolderItem = (
  folderId: string,
  folderName: string,
  parentFolderId: string | null,
  childrenCount: number,
): ContentItem => ({
  id: folderId,
  kind: 'folder',
  name: folderName,
  parentId: parentFolderId,
  childrenCount,
  status: 'active',
  createdAt: SYNTHETIC_FOLDER_TIMESTAMP,
  updatedAt: SYNTHETIC_FOLDER_TIMESTAMP,
  mimeType: null,
  sizeBytes: null,
  importedAt: null,
  origin: null,
  googleFileId: null,
})

type FolderFilesProps = {
  folderId: string
  depth: number
  highlightBranch?: boolean
  activeFolderId: string
  activePreviewId: string | null
  onOpenFile: (fileId: string, parentFolderId: string) => void
  onDragStartItem: (item: ContentItem, event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => void
  isDraggingItem: (itemId: string) => boolean
  onItemContextMenu: (item: ContentItem, event: ReactMouseEvent<HTMLElement>) => void
}

const FolderFiles = ({
  folderId,
  depth,
  highlightBranch = false,
  activeFolderId,
  activePreviewId,
  onOpenFile,
  onDragStartItem,
  onDragEnd,
  onFolderDragOver,
  onFolderDrop,
  isDraggingItem,
  onItemContextMenu,
}: FolderFilesProps) => {
  const query = useListContentItemsQuery(folderId, 'name', 'asc')

  if (query.isPending) {
    return (
      <Text size="xs" c="dimmed" px="sm" py={4} style={{ marginLeft: depth * TREE_INDENT_STEP }}>
        Loading...
      </Text>
    )
  }

  if (query.error) {
    return (
      <Text size="xs" c="red" px="sm" py={4} style={{ marginLeft: depth * TREE_INDENT_STEP }}>
        Failed to load
      </Text>
    )
  }

  const files = query.data?.items.filter(isFileItem) ?? []
  if (!files.length) {
    return null
  }

  return (
    <Box
      className={[
        'sidebar-tree-children',
        highlightBranch ? 'sidebar-tree-children--active-branch' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--sidebar-tree-line-x': `${depth * TREE_INDENT_STEP - 1}px` } as CSSProperties}
    >
      {files.map((item) => {
        const isActiveFile = activePreviewId === item.id && activeFolderId === folderId
        const fileActiveVariant: ActiveVariant = isActiveFile ? 'file' : 'solid'

        return (
          <TreeRow
            key={item.id}
            depth={depth}
            active={isActiveFile}
            activeVariant={fileActiveVariant}
            isFile
            name={item.name}
            mimeType={item.mimeType}
            draggable
            isDragging={isDraggingItem(item.id)}
            onDragStart={(event) => onDragStartItem(item, event)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => {
              event.stopPropagation()
              onFolderDragOver(folderId, event)
            }}
            onDrop={(event) => {
              event.stopPropagation()
              onFolderDrop(folderId, event)
            }}
            onContextMenu={(event) => onItemContextMenu(item, event)}
            onClick={() => onOpenFile(item.id, folderId)}
          />
        )
      })}
    </Box>
  )
}

const FolderChildren = ({
  folderNode,
  parentFolderId,
  depth,
  highlightBranch = false,
  expandedIds,
  fileContentVisibleFolderIds,
  activeFolderId,
  activePreviewId,
  onToggleExpanded,
  onSetFileContentVisibility,
  onOpenFolder,
  onOpenFile,
  onDownloadItem,
  onCopyItem,
  onRenameItem,
  onMoveItem,
  onDeleteItem,
  onShareItem,
  onDragStartItem,
  onDragEnd,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  getFolderDropState,
  isDraggingItem,
  getFolderItem,
  onItemContextMenu,
}: FolderChildrenProps) => {
  if (!folderNode.children.length) {
    return null
  }

  return (
    <Box
      className={[
        'sidebar-tree-children',
        highlightBranch ? 'sidebar-tree-children--active-branch' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--sidebar-tree-line-x': `${depth * TREE_INDENT_STEP - 1}px` } as CSSProperties}
    >
      {folderNode.children.map((childFolder) => {
        const folderItem =
          getFolderItem(childFolder.id) ??
          createFallbackFolderItem(
            childFolder.id,
            childFolder.name,
            parentFolderId,
            childFolder.children.length,
          )
        const isExpanded = expandedIds.has(childFolder.id)
        const showFiles = fileContentVisibleFolderIds.has(childFolder.id)
        const isActiveFolder = normalizeFolderId(activeFolderId) === childFolder.id
        const folderActiveVariant: ActiveVariant = isActiveFolder && Boolean(activePreviewId) ? 'context' : 'solid'

        const toggleFolderView = () => {
          if (isExpanded && !showFiles) {
            onSetFileContentVisibility(childFolder.id, true)
            return
          }

          const nextExpandedState = !isExpanded
          onToggleExpanded(childFolder.id)
          onSetFileContentVisibility(childFolder.id, nextExpandedState)
        }

        return (
          <Box key={childFolder.id}>
            <TreeRow
              depth={depth}
              active={isActiveFolder}
              activeVariant={folderActiveVariant}
              isFile={false}
              name={childFolder.name}
              canExpand
              expanded={isExpanded}
              draggable
              isDragging={isDraggingItem(childFolder.id)}
              onDragStart={(event) => onDragStartItem(folderItem, event)}
              onDragEnd={onDragEnd}
              onToggle={toggleFolderView}
              onClick={() =>
                handleFolderRowClick({
                  folderId: childFolder.id,
                  canExpand: true,
                  isActive: isActiveFolder,
                  onOpenFolder,
                  onToggleExpanded: toggleFolderView,
                })
              }
              dropState={getFolderDropState(childFolder.id)}
              onDragOver={(event) => {
                event.stopPropagation()
                onFolderDragOver(childFolder.id, event)
              }}
              onDrop={(event) => {
                event.stopPropagation()
                onFolderDrop(childFolder.id, event)
              }}
              onDragLeave={(event) => {
                event.stopPropagation()
                onFolderDragLeave(childFolder.id)
              }}
              onContextMenu={(event) => onItemContextMenu(folderItem, event)}
            />

            {isExpanded ? (
              <>
                {showFiles ? (
                  <FolderFiles
                    folderId={childFolder.id}
                    depth={depth + 1}
                    highlightBranch={isActiveFolder}
                    activeFolderId={activeFolderId}
                    activePreviewId={activePreviewId}
                    onOpenFile={onOpenFile}
                    onDragStartItem={onDragStartItem}
                    onDragEnd={onDragEnd}
                    onFolderDragOver={onFolderDragOver}
                    onFolderDrop={onFolderDrop}
                    isDraggingItem={isDraggingItem}
                    onItemContextMenu={onItemContextMenu}
                  />
                ) : null}

                <FolderChildren
                  folderNode={childFolder}
                  parentFolderId={childFolder.id}
                  depth={depth + 1}
                  highlightBranch={isActiveFolder}
                  expandedIds={expandedIds}
                  fileContentVisibleFolderIds={fileContentVisibleFolderIds}
                  activeFolderId={activeFolderId}
                  activePreviewId={activePreviewId}
                  onToggleExpanded={onToggleExpanded}
                  onSetFileContentVisibility={onSetFileContentVisibility}
                  onOpenFolder={onOpenFolder}
                  onOpenFile={onOpenFile}
                  onDownloadItem={onDownloadItem}
                  onCopyItem={onCopyItem}
                  onRenameItem={onRenameItem}
                  onMoveItem={onMoveItem}
                  onDeleteItem={onDeleteItem}
                  onShareItem={onShareItem}
                  onDragStartItem={onDragStartItem}
                  onDragEnd={onDragEnd}
                  onFolderDragOver={onFolderDragOver}
                  onFolderDrop={onFolderDrop}
                  onFolderDragLeave={onFolderDragLeave}
                  getFolderDropState={getFolderDropState}
                  isDraggingItem={isDraggingItem}
                  getFolderItem={getFolderItem}
                  onItemContextMenu={onItemContextMenu}
                />
              </>
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}

export const DataroomSidebar = ({
  currentUser,
  folderTree,
  activeFolderId,
  activePreviewId,
  expandedIds,
  fileContentVisibleFolderIds,
  onNewFolder,
  onImportFromGoogle,
  onImportFromComputer,
  onToggleExpanded,
  onSetFileContentVisibility,
  onOpenFolder,
  onOpenFile,
  onSignOut,
  onDownloadItem,
  onCopyItem,
  onRenameItem,
  onMoveItem,
  onDeleteItem,
  onShareItem,
  onRootCreateFolder,
  onRootDownload,
  onRootShare,
  onDragStartItem,
  onDragEnd,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  getFolderDropState,
  isDraggingItem,
  getFolderItem,
}: DataroomSidebarProps) => {
  const isRootActive = normalizeFolderId(activeFolderId) === 'root'
  const isRootExpanded = expandedIds.has('root')
  const rootShowFiles = fileContentVisibleFolderIds.has('root')
  const rootActiveVariant: ActiveVariant = isRootActive && Boolean(activePreviewId) ? 'context' : 'solid'
  const accountName = currentUser.displayName || currentUser.email || currentUser.firebaseUid
  const accountSubtitle = currentUser.displayName && currentUser.email ? currentUser.email : t('accountMember')
  const accountInitials = toInitials(accountName)
  const avatarColor = pickAvatarColor(currentUser.id || currentUser.firebaseUid || accountName)
  const avatarCacheId = currentUser.id || currentUser.firebaseUid || accountName
  const createLabel = t('create')
  const createLabelWithShortcut = withShortcutHint(createLabel, APP_SHORTCUTS.createFolder.label)
  const { avatarSrc, showPhotoAvatar, handleAvatarError, handleAvatarLoad } = useCachedAvatarImage({
    cacheId: avatarCacheId,
    photoUrl: currentUser.photoUrl,
  })
  const [contextMenuState, setContextMenuState] = useState<SidebarContextMenuState | null>(null)

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

  const handleItemContextMenu = (item: ContentItem, event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuState({
      kind: 'item',
      item,
      x: event.clientX,
      y: event.clientY,
    })
  }

  const handleRootContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuState({
      kind: 'root',
      x: event.clientX,
      y: event.clientY,
    })
  }

  return (
    <Box h="100%" p="sm" pb={0} className="dataroom-sidebar">
      <Title order={5} className="dataroom-sidebar__title">
        Dataroom.demo
      </Title>

      <Box className="dataroom-sidebar__quick-actions">
        <ImportSourceMenu
          onNewFolder={onNewFolder}
          onImportFromGoogle={onImportFromGoogle}
          onImportFromComputer={onImportFromComputer}
          position="right-start"
          offset={8}
        >
          <Button
            variant="filled"
            size="sm"
            fullWidth
            className="dataroom-sidebar__create-button"
            leftSection={<IconPlus size={18} />}
            rightSection={<IconChevronDown size={14} />}
            title={createLabelWithShortcut}
            aria-label={createLabelWithShortcut}
          >
            {createLabel}
          </Button>
        </ImportSourceMenu>
      </Box>

      <Text size="xs" fw={600} c="var(--text-secondary)" className="dataroom-sidebar__tree-title">
        Documents
      </Text>

      <ScrollArea
        className="dataroom-sidebar__tree"
        onDragOver={(event) => {
          event.stopPropagation()
          onFolderDragOver('root', event)
        }}
        onDrop={(event) => {
          event.stopPropagation()
          onFolderDrop('root', event)
        }}
        onDragLeave={(event) => {
          const nextTarget = event.relatedTarget as Node | null
          if (nextTarget && event.currentTarget.contains(nextTarget)) {
            return
          }
          onFolderDragLeave('root')
        }}
      >
        <TreeRow
          depth={0}
          active={isRootActive}
          activeVariant={rootActiveVariant}
          isFile={false}
          name="Data Room"
          canExpand
          expanded={isRootExpanded}
          onToggle={() => {
            if (isRootExpanded && !rootShowFiles) {
              onSetFileContentVisibility('root', true)
              return
            }
            const nextExpandedState = !isRootExpanded
            onToggleExpanded('root')
            onSetFileContentVisibility('root', nextExpandedState)
          }}
          onClick={() =>
            handleFolderRowClick({
              folderId: 'root',
              canExpand: true,
              isActive: isRootActive,
              onOpenFolder,
              onToggleExpanded: () => {
                if (isRootExpanded && !rootShowFiles) {
                  onSetFileContentVisibility('root', true)
                  return
                }
                const nextExpandedState = !isRootExpanded
                onToggleExpanded('root')
                onSetFileContentVisibility('root', nextExpandedState)
              },
            })
          }
          dropState={getFolderDropState('root')}
          onDragOver={(event) => {
            event.stopPropagation()
            onFolderDragOver('root', event)
          }}
          onDrop={(event) => {
            event.stopPropagation()
            onFolderDrop('root', event)
          }}
          onDragLeave={(event) => {
            event.stopPropagation()
            onFolderDragLeave('root')
          }}
          onContextMenu={handleRootContextMenu}
        />

        {isRootExpanded && folderTree ? (
          <FolderChildren
            folderNode={folderTree}
            parentFolderId={folderTree.id === 'root' ? null : folderTree.id}
            depth={1}
            highlightBranch={isRootActive}
            expandedIds={expandedIds}
            fileContentVisibleFolderIds={fileContentVisibleFolderIds}
            activeFolderId={activeFolderId}
            activePreviewId={activePreviewId}
            onToggleExpanded={onToggleExpanded}
            onSetFileContentVisibility={onSetFileContentVisibility}
            onOpenFolder={onOpenFolder}
            onOpenFile={onOpenFile}
            onDownloadItem={onDownloadItem}
            onCopyItem={onCopyItem}
            onRenameItem={onRenameItem}
            onMoveItem={onMoveItem}
            onDeleteItem={onDeleteItem}
            onShareItem={onShareItem}
            onDragStartItem={onDragStartItem}
            onDragEnd={onDragEnd}
            onFolderDragOver={onFolderDragOver}
            onFolderDrop={onFolderDrop}
            onFolderDragLeave={onFolderDragLeave}
            getFolderDropState={getFolderDropState}
            isDraggingItem={isDraggingItem}
            getFolderItem={getFolderItem}
            onItemContextMenu={handleItemContextMenu}
          />
        ) : null}

        {isRootExpanded && rootShowFiles ? (
          <FolderFiles
            folderId="root"
            depth={1}
            highlightBranch={isRootActive}
            activeFolderId={activeFolderId}
            activePreviewId={activePreviewId}
            onOpenFile={onOpenFile}
            onDragStartItem={onDragStartItem}
            onDragEnd={onDragEnd}
            onFolderDragOver={onFolderDragOver}
            onFolderDrop={onFolderDrop}
            isDraggingItem={isDraggingItem}
            onItemContextMenu={handleItemContextMenu}
          />
        ) : null}
      </ScrollArea>

      <Box className="dataroom-sidebar__account">
        <Menu withinPortal position="top-start" offset={8}>
          <Menu.Target>
            <Box component="button" type="button" className="dataroom-sidebar__account-card">
              <Group gap={6} wrap="nowrap">
                <Box
                  className="dataroom-sidebar__account-avatar"
                  style={!showPhotoAvatar ? { backgroundColor: avatarColor } : undefined}
                >
                  {showPhotoAvatar ? (
                    <img
                      src={avatarSrc ?? undefined}
                      alt={accountName}
                      className="dataroom-sidebar__account-avatar-image"
                      onError={handleAvatarError}
                      onLoad={handleAvatarLoad}
                    />
                  ) : (
                    <span className="dataroom-sidebar__account-avatar-fallback">{accountInitials}</span>
                  )}
                </Box>

                <Box className="dataroom-sidebar__account-meta">
                  <Text size="sm" fw={600} truncate="end" className="dataroom-sidebar__account-name">
                    {accountName}
                  </Text>
                  <Text size="xs" c="var(--text-secondary)" truncate="end" className="dataroom-sidebar__account-subtitle">
                    {accountSubtitle}
                  </Text>
                </Box>

                <Box className="dataroom-sidebar__account-more">
                  <IconDotsVertical size={16} />
                </Box>
              </Group>
            </Box>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item leftSection={<IconLogout size={14} />} onClick={onSignOut}>
              {t('signOut')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>
      <Menu
        opened={Boolean(contextMenuState)}
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
              left: contextMenuState ? contextMenuState.x : -9999,
              top: contextMenuState ? contextMenuState.y : -9999,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </Menu.Target>
        <Menu.Dropdown onContextMenu={(event) => event.preventDefault()}>
          {contextMenuState?.kind === 'item' ? (
            <SidebarItemActionsMenuContent
              item={contextMenuState.item}
              onDownloadItem={onDownloadItem}
              onCopyItem={onCopyItem}
              onRenameItem={onRenameItem}
              onMoveItem={onMoveItem}
              onDeleteItem={onDeleteItem}
              onShareItem={onShareItem}
              onAction={() => setContextMenuState(null)}
            />
          ) : null}
          {contextMenuState?.kind === 'root' ? (
            <SidebarRootActionsMenuContent
              onCreateFolder={onRootCreateFolder}
              onDownload={onRootDownload}
              onShare={onRootShare}
              onAction={() => setContextMenuState(null)}
            />
          ) : null}
        </Menu.Dropdown>
      </Menu>
    </Box>
  )
}
