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

type DropState = 'none' | 'valid' | 'warning' | 'invalid'

type DataroomSidebarProps = {
  currentUser: UserProfile
  folderTree: FolderNode | undefined
  activeFolderId: string
  activePreviewId: string | null
  expandedIds: Set<string>
  fileContentVisibleFolderIds: Set<string>
  knownFolderItemCounts: Record<string, number>
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
  knownFolderItemCounts: Record<string, number>
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
const SIDEBAR_TITLE_HEIGHT_PX = 36
const SIDEBAR_STACK_GAP_PX = 8
const CREATE_BUTTON_HEIGHT_PX = 50
const RAIL_ACTION_ICON_SIZE_PX = 34

const SIDEBAR_CLASS_NAME = 'flex min-h-0 flex-col gap-2 overflow-hidden'
const SIDEBAR_RAIL_CLASS_NAME = 'flex h-full flex-col items-center px-[6px] pb-3'
const SIDEBAR_RAIL_ACTIONS_CLASS_NAME = 'flex flex-col items-center'
const SIDEBAR_RAIL_ACTION_ICON_CLASS_NAME = 'inline-flex h-[34px] min-h-[34px] w-[34px] min-w-[34px] items-center justify-center'
const SIDEBAR_RAIL_ACCOUNT_CLASS_NAME =
  'mt-auto inline-flex cursor-pointer items-center justify-center rounded-full border-none bg-transparent px-0 py-[7px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'
const SIDEBAR_RAIL_AVATAR_CLASS_NAME =
  'grid h-8 w-8 place-items-center overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255_/_24%),0_1px_2px_rgb(16_24_40_/_16%)]'
const SIDEBAR_RAIL_AVATAR_IMAGE_CLASS_NAME = 'h-full w-full object-cover'
const SIDEBAR_RAIL_AVATAR_FALLBACK_CLASS_NAME =
  'select-none text-xs font-bold uppercase leading-none tracking-[0.02em] text-white'

const SIDEBAR_TITLE_CLASS_NAME = 'm-0 flex h-9 min-w-0 flex-none items-center overflow-hidden text-ellipsis whitespace-nowrap'
const SIDEBAR_QUICK_ACTIONS_CLASS_NAME = 'grid flex-none gap-2 pb-2'
const SIDEBAR_CREATE_BUTTON_CLASS_NAME =
  "h-[50px] min-h-[50px] justify-start rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-2.5 text-white transition-[background-color,border-color,transform] duration-[120ms] ease-[ease] hover:border-[var(--accent-hover)] hover:bg-[var(--accent-hover)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)] [&_.mantine-Button-inner]:min-h-[50px] [&_.mantine-Button-inner]:w-full [&_.mantine-Button-inner]:items-center [&_.mantine-Button-inner]:justify-start [&_.mantine-Button-section[data-position='left']]:me-2.5 [&_.mantine-Button-section[data-position='left']]:inline-flex [&_.mantine-Button-section[data-position='left']]:items-center [&_.mantine-Button-section[data-position='left']]:justify-center [&_.mantine-Button-section[data-position='left']]:text-[rgb(255_255_255_/_92%)] [&_.mantine-Button-label]:inline-flex [&_.mantine-Button-label]:flex-1 [&_.mantine-Button-label]:items-center [&_.mantine-Button-label]:text-left [&_.mantine-Button-label]:font-bold [&_.mantine-Button-label]:leading-none [&_.mantine-Button-label]:tracking-[0.01em] [&_.mantine-Button-label]:-translate-y-px [&_.mantine-Button-section[data-position='right']]:ms-2.5 [&_.mantine-Button-section[data-position='right']]:me-0 [&_.mantine-Button-section[data-position='right']]:inline-flex [&_.mantine-Button-section[data-position='right']]:items-center [&_.mantine-Button-section[data-position='right']]:justify-center [&_.mantine-Button-section[data-position='right']]:text-[rgb(255_255_255_/_80%)] [&_.mantine-Button-section_svg]:block [&_.mantine-Button-section_svg]:-translate-y-px"
const SIDEBAR_TREE_TITLE_CLASS_NAME = 'pb-1 tracking-[0.01em]'
const SIDEBAR_TREE_CLASS_NAME = 'min-h-0 flex-1 overflow-hidden'

const SIDEBAR_ACCOUNT_WRAP_CLASS_NAME = 'flex-none border-t border-[var(--separator-soft)] p-2'
const SIDEBAR_ACCOUNT_CARD_CLASS_NAME =
  'w-full cursor-pointer rounded-xl border-none bg-transparent px-2 py-[7px] text-left transition-colors duration-[120ms] ease-[ease] hover:bg-[var(--bg-hover-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]'
const SIDEBAR_ACCOUNT_AVATAR_CLASS_NAME =
  'grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full p-0 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_24%),0_1px_2px_rgb(16_24_40_/_16%)]'
const SIDEBAR_ACCOUNT_AVATAR_IMAGE_CLASS_NAME = 'h-full w-full object-cover'
const SIDEBAR_ACCOUNT_AVATAR_FALLBACK_CLASS_NAME =
  'select-none text-xs font-bold uppercase leading-none tracking-[0.02em] text-white'
const SIDEBAR_ACCOUNT_META_CLASS_NAME = 'min-w-0 flex-1 py-px'
const SIDEBAR_ACCOUNT_NAME_CLASS_NAME = 'leading-[1.25]'
const SIDEBAR_ACCOUNT_SUBTITLE_CLASS_NAME = 'mt-0 block leading-[1.35]'
const SIDEBAR_ACCOUNT_MORE_CLASS_NAME = 'inline-flex flex-none items-center justify-center text-[var(--text-secondary)]'

const TREE_ROW_BASE_CLASS_NAME =
  'sidebar-tree-row relative block w-[calc(100%-var(--sidebar-tree-indent))] min-w-[164px] cursor-pointer rounded-lg border-none bg-transparent p-0 text-left transition-colors duration-[120ms] ease-[ease] ml-[var(--sidebar-tree-indent)] hover:bg-[var(--tree-row-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]'
const TREE_ROW_ACTIVE_SOLID_CLASS_NAME =
  '!bg-[var(--tree-row-active-solid-bg)] !shadow-[inset_0_0_0_1px_var(--tree-row-active-solid-border)] hover:!bg-[var(--tree-row-active-solid-hover-bg)] hover:!shadow-[inset_0_0_0_1px_var(--tree-row-active-solid-hover-border)]'
const TREE_ROW_ACTIVE_FILE_CLASS_NAME =
  '!bg-[var(--tree-row-active-file-bg)] !shadow-[inset_0_0_0_1px_var(--tree-row-active-file-border)] hover:!bg-[var(--tree-row-active-file-hover-bg)] hover:!shadow-[inset_0_0_0_1px_var(--tree-row-active-file-hover-border)]'
const TREE_ROW_ACTIVE_CONTEXT_CLASS_NAME =
  '!bg-[var(--tree-row-active-context-bg)] !shadow-[inset_0_0_0_1px_var(--tree-row-active-context-border)] hover:!bg-[var(--tree-row-active-context-hover-bg)] hover:!shadow-[inset_0_0_0_1px_var(--tree-row-active-context-hover-border)]'
const TREE_ROW_DROP_VALID_CLASS_NAME = '!bg-[var(--state-success-bg)]'
const TREE_ROW_DROP_WARNING_CLASS_NAME = '!bg-[var(--state-warning-bg)]'
const TREE_ROW_DROP_INVALID_CLASS_NAME = '!bg-[var(--state-danger-bg)]'
const TREE_ROW_DRAGGING_CLASS_NAME = 'opacity-[0.45]'
const TREE_ROW_EXPANDER_CLASS_NAME = 'inline-flex cursor-pointer'
const TREE_ROW_ICON_CLASS_NAME = 'inline-flex h-4 w-4 flex-none items-center justify-center [&>svg]:h-4 [&>svg]:w-4'
const TREE_ROW_LABEL_CLASS_NAME = 'inline-flex min-w-0 max-w-full flex-1 items-baseline overflow-hidden whitespace-nowrap'
const TREE_ROW_NAME_BASE_CLASS_NAME = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap'
const TREE_ROW_NAME_EXT_CLASS_NAME = 'flex-none whitespace-nowrap'

const TREE_CHILDREN_BASE_CLASS_NAME =
  'sidebar-tree-children relative pl-2 before:pointer-events-none before:absolute before:left-[var(--sidebar-tree-line-x)] before:top-0 before:bottom-0 before:w-px before:bg-[var(--tree-line)] before:opacity-90 [.sidebar-tree-row+&::before]:top-[6px] [&:last-child::before]:bottom-[6px]'
const TREE_CHILDREN_ACTIVE_BRANCH_CLASS_NAME =
  'before:!left-[calc(var(--sidebar-tree-line-x)-0.5px)] before:!w-0.5 before:!rounded-full before:!bg-[var(--tree-branch-active)] before:!opacity-100'

const SIDEBAR_RAIL_TOP_PADDING = `calc(var(--mantine-spacing-sm) + ${SIDEBAR_TITLE_HEIGHT_PX + SIDEBAR_STACK_GAP_PX + (CREATE_BUTTON_HEIGHT_PX - RAIL_ACTION_ICON_SIZE_PX) / 2}px)`

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
    <Box className={SIDEBAR_RAIL_CLASS_NAME} style={{ paddingTop: SIDEBAR_RAIL_TOP_PADDING }}>
      <Group className={SIDEBAR_RAIL_ACTIONS_CLASS_NAME} gap={4}>
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
                className={SIDEBAR_RAIL_ACTION_ICON_CLASS_NAME}
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
          <Box component="button" type="button" className={SIDEBAR_RAIL_ACCOUNT_CLASS_NAME} aria-label={accountName}>
            <Box
              className={SIDEBAR_RAIL_AVATAR_CLASS_NAME}
              style={!showPhotoAvatar ? { backgroundColor: avatarColor } : undefined}
            >
              {showPhotoAvatar ? (
                <img
                  src={avatarSrc ?? undefined}
                  alt={accountName}
                  className={SIDEBAR_RAIL_AVATAR_IMAGE_CLASS_NAME}
                  onError={handleAvatarError}
                  onLoad={handleAvatarLoad}
                />
              ) : (
                <span className={SIDEBAR_RAIL_AVATAR_FALLBACK_CLASS_NAME}>{accountInitials}</span>
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
      ? TREE_ROW_DROP_VALID_CLASS_NAME
      : dropState === 'warning'
        ? TREE_ROW_DROP_WARNING_CLASS_NAME
      : dropState === 'invalid'
        ? TREE_ROW_DROP_INVALID_CLASS_NAME
        : ''

  const className = [
    TREE_ROW_BASE_CLASS_NAME,
    !dropClass && active && activeVariant === 'solid' ? TREE_ROW_ACTIVE_SOLID_CLASS_NAME : '',
    !dropClass && active && activeVariant === 'file' ? TREE_ROW_ACTIVE_FILE_CLASS_NAME : '',
    !dropClass && active && activeVariant === 'context' ? TREE_ROW_ACTIVE_CONTEXT_CLASS_NAME : '',
    isDragging ? TREE_ROW_DRAGGING_CLASS_NAME : '',
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
            className={TREE_ROW_EXPANDER_CLASS_NAME}
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

        <Box className={TREE_ROW_ICON_CLASS_NAME}>
          {isFile ? (
            <FileTypeIcon iconKey={fileTypePresentation?.iconKey ?? 'default'} size={16} />
          ) : (
            <IconFolder size={16} color="var(--accent)" />
          )}
        </Box>

        <Text
          className={TREE_ROW_LABEL_CLASS_NAME}
          size="sm"
          fw={active ? 600 : 500}
          c={labelColor}
          title={name}
        >
          <span className={TREE_ROW_NAME_BASE_CLASS_NAME}>{nameParts.base}</span>
          {nameParts.extension ? <span className={TREE_ROW_NAME_EXT_CLASS_NAME}>{nameParts.extension}</span> : null}
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
  fileCount: childrenCount,
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
        TREE_CHILDREN_BASE_CLASS_NAME,
        highlightBranch ? TREE_CHILDREN_ACTIVE_BRANCH_CLASS_NAME : '',
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
  knownFolderItemCounts,
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
  const normalizedActiveFolderId = normalizeFolderId(activeFolderId)

  return (
    <Box
      className={[
        TREE_CHILDREN_BASE_CLASS_NAME,
        highlightBranch ? TREE_CHILDREN_ACTIVE_BRANCH_CLASS_NAME : '',
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
        const knownItemCount = knownFolderItemCounts[childFolder.id]
        const folderFileCount = typeof folderItem.fileCount === 'number' ? folderItem.fileCount : null
        const hasKnownItems = typeof knownItemCount === 'number' ? knownItemCount : folderFileCount
        const canExpand = childFolder.children.length > 0 || (hasKnownItems !== null && hasKnownItems > 0)
        const isActiveFolder = normalizedActiveFolderId === childFolder.id
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
              canExpand={canExpand}
              expanded={isExpanded}
              draggable
              isDragging={isDraggingItem(childFolder.id)}
              onDragStart={(event) => onDragStartItem(folderItem, event)}
              onDragEnd={onDragEnd}
              onToggle={toggleFolderView}
              onClick={() =>
                handleFolderRowClick({
                  folderId: childFolder.id,
                  canExpand,
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
                <FolderChildren
                  folderNode={childFolder}
                  parentFolderId={childFolder.id}
                  depth={depth + 1}
                  highlightBranch={isActiveFolder}
                  expandedIds={expandedIds}
                  fileContentVisibleFolderIds={fileContentVisibleFolderIds}
                  knownFolderItemCounts={knownFolderItemCounts}
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
  knownFolderItemCounts,
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
  const normalizedActiveFolderId = normalizeFolderId(activeFolderId)
  const isRootActive = normalizedActiveFolderId === 'root'
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
    <Box h="100%" p="sm" pb={0} className={SIDEBAR_CLASS_NAME}>
      <Title order={5} className={SIDEBAR_TITLE_CLASS_NAME}>
        Dataroom.demo
      </Title>

      <Box className={SIDEBAR_QUICK_ACTIONS_CLASS_NAME}>
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
            className={SIDEBAR_CREATE_BUTTON_CLASS_NAME}
            leftSection={<IconPlus size={18} />}
            rightSection={<IconChevronDown size={14} />}
            title={createLabelWithShortcut}
            aria-label={createLabelWithShortcut}
          >
            {createLabel}
          </Button>
        </ImportSourceMenu>
      </Box>

      <Text size="xs" fw={600} c="var(--text-secondary)" className={SIDEBAR_TREE_TITLE_CLASS_NAME}>
        Documents
      </Text>

      <ScrollArea
        className={SIDEBAR_TREE_CLASS_NAME}
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
            knownFolderItemCounts={knownFolderItemCounts}
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

      <Box className={SIDEBAR_ACCOUNT_WRAP_CLASS_NAME}>
        <Menu withinPortal position="top-start" offset={8}>
          <Menu.Target>
            <Box component="button" type="button" className={SIDEBAR_ACCOUNT_CARD_CLASS_NAME}>
              <Group gap={6} wrap="nowrap">
                <Box
                  className={SIDEBAR_ACCOUNT_AVATAR_CLASS_NAME}
                  style={!showPhotoAvatar ? { backgroundColor: avatarColor } : undefined}
                >
                  {showPhotoAvatar ? (
                    <img
                      src={avatarSrc ?? undefined}
                      alt={accountName}
                      className={SIDEBAR_ACCOUNT_AVATAR_IMAGE_CLASS_NAME}
                      onError={handleAvatarError}
                      onLoad={handleAvatarLoad}
                    />
                  ) : (
                    <span className={SIDEBAR_ACCOUNT_AVATAR_FALLBACK_CLASS_NAME}>{accountInitials}</span>
                  )}
                </Box>

                <Box className={SIDEBAR_ACCOUNT_META_CLASS_NAME}>
                  <Text size="sm" fw={600} truncate="end" className={SIDEBAR_ACCOUNT_NAME_CLASS_NAME}>
                    {accountName}
                  </Text>
                  <Text size="xs" c="var(--text-secondary)" truncate="end" className={SIDEBAR_ACCOUNT_SUBTITLE_CLASS_NAME}>
                    {accountSubtitle}
                  </Text>
                </Box>

                <Box className={SIDEBAR_ACCOUNT_MORE_CLASS_NAME}>
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
