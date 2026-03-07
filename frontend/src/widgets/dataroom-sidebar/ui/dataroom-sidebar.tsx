import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconFile,
  IconFolder,
  IconFolderPlus,
  IconHome2,
  IconLogout,
  IconUpload,
} from '@tabler/icons-react'
import type { CSSProperties, DragEvent } from 'react'
import { useState } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { isFileItem } from '@/entities/content-item'
import type { UserProfile } from '@/entities/user'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { t } from '@/shared/i18n/messages'
import { normalizeFolderId } from '@/shared/routes/dataroom-routes'
import { ActionIcon, Box, Button, Group, Menu, ScrollArea, Text, Title, Tooltip } from '@/shared/ui'
import './dataroom-sidebar.css'

type DropState = 'none' | 'valid' | 'invalid'

type DataroomSidebarProps = {
  currentUser: UserProfile
  activeFolderId: string
  activePreviewId: string | null
  expandedIds: Set<string>
  onGoRoot: () => void
  onNewFolder: () => void
  onImportFile: () => void
  onToggleExpanded: (folderId: string) => void
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string) => void
  onSignOut: () => void
  onDragStartItem: (item: ContentItem, event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave: (folderId: string) => void
  getFolderDropState: (folderId: string) => DropState
  isDraggingItem: (itemId: string) => boolean
}

type FolderChildrenProps = {
  folderId: string
  depth: number
  highlightBranch?: boolean
  expandedIds: Set<string>
  activeFolderId: string
  activePreviewId: string | null
  onToggleExpanded: (folderId: string) => void
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string) => void
  onDragStartItem: (item: ContentItem, event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onFolderDragOver: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDrop: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave: (folderId: string) => void
  getFolderDropState: (folderId: string) => DropState
  isDraggingItem: (itemId: string) => boolean
}

type ActiveVariant = 'solid' | 'file' | 'context'

type DataroomSidebarRailProps = {
  currentUser: UserProfile
  onGoRoot: () => void
  onNewFolder: () => void
  onImportFile: () => void
  onSignOut: () => void
}

const TREE_INDENT_STEP = 20

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

const pickAvatarColor = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export const DataroomSidebarRail = ({
  currentUser,
  onGoRoot,
  onNewFolder,
  onImportFile,
  onSignOut,
}: DataroomSidebarRailProps) => {
  const accountName = currentUser.displayName || currentUser.email || currentUser.firebaseUid
  const accountInitials = toInitials(accountName)
  const avatarColor = pickAvatarColor(currentUser.id || currentUser.firebaseUid || accountName)
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)
  const showPhotoAvatar = Boolean(currentUser.photoUrl) && failedPhotoUrl !== currentUser.photoUrl

  return (
    <Box className="dataroom-sidebar-rail">
      <Group className="dataroom-sidebar-rail__actions" gap={4}>
        <Tooltip label={t('goToRoot')} position="right">
          <ActionIcon
            className="dataroom-sidebar-rail__action-icon"
            variant="subtle"
            size="lg"
            radius="md"
            aria-label={t('goToRoot')}
            onClick={onGoRoot}
          >
            <IconHome2 size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('newFolder')} position="right">
          <ActionIcon
            className="dataroom-sidebar-rail__action-icon"
            variant="subtle"
            size="lg"
            radius="md"
            aria-label={t('newFolder')}
            onClick={onNewFolder}
          >
            <IconFolderPlus size={18} />
          </ActionIcon>
        </Tooltip>

        <Tooltip label={t('importFile')} position="right">
          <ActionIcon
            className="dataroom-sidebar-rail__action-icon"
            variant="subtle"
            size="lg"
            radius="md"
            aria-label={t('importFile')}
            onClick={onImportFile}
          >
            <IconUpload size={18} />
          </ActionIcon>
        </Tooltip>
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
                  src={currentUser.photoUrl ?? undefined}
                  alt={accountName}
                  className="dataroom-sidebar-rail__avatar-image"
                  onError={() => setFailedPhotoUrl(currentUser.photoUrl)}
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
  isExpanded,
  isActive,
  onOpenFolder,
  onToggleExpanded,
}: {
  folderId: string
  canExpand: boolean
  isExpanded: boolean
  isActive: boolean
  onOpenFolder: (folderId: string) => void
  onToggleExpanded: (folderId: string) => void
}) => {
  onOpenFolder(folderId)

  if (!canExpand) {
    return
  }

  if (isActive) {
    onToggleExpanded(folderId)
    return
  }

  if (!isActive && !isExpanded) {
    onToggleExpanded(folderId)
  }
}

const TreeRow = ({
  depth,
  active,
  activeVariant = 'solid',
  isFile,
  name,
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
}: {
  depth: number
  active: boolean
  activeVariant?: ActiveVariant
  isFile: boolean
  name: string
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
}) => {
  const dropClass =
    dropState === 'valid'
      ? 'sidebar-tree-row--drop-valid'
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

  const labelColor = !active ? 'var(--text-primary)' : activeVariant === 'context' ? '#4b5f84' : '#2f6fed'

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
            {expanded ? <IconChevronDown size={14} color="#6d7588" /> : <IconChevronRight size={14} color="#6d7588" />}
          </Box>
        ) : null}

        <Box className="sidebar-tree-row__icon">
          {isFile ? <IconFile size={16} color="#667085" /> : <IconFolder size={16} color="#2f6fed" />}
        </Box>

        <Text
          className="sidebar-tree-row__label"
          size="sm"
          fw={active ? 600 : 500}
          c={labelColor}
          truncate="end"
        >
          {name}
        </Text>
      </Group>
    </Box>
  )
}

const FolderChildren = ({
  folderId,
  depth,
  highlightBranch = false,
  expandedIds,
  activeFolderId,
  activePreviewId,
  onToggleExpanded,
  onOpenFolder,
  onOpenFile,
  onDragStartItem,
  onDragEnd,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  getFolderDropState,
  isDraggingItem,
}: FolderChildrenProps) => {
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
      {query.data?.items.map((item) => {
        if (isFileItem(item)) {
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
              onClick={() => onOpenFile(item.id, folderId)}
            />
          )
        }

        const isExpanded = expandedIds.has(item.id)
        const canExpand = item.childrenCount > 0
        const isActiveFolder = normalizeFolderId(activeFolderId) === item.id
        const folderActiveVariant: ActiveVariant = isActiveFolder && Boolean(activePreviewId) ? 'context' : 'solid'

        return (
          <Box key={item.id}>
            <TreeRow
              depth={depth}
              active={isActiveFolder}
              activeVariant={folderActiveVariant}
              isFile={false}
              name={item.name}
              canExpand={canExpand}
              expanded={isExpanded}
              draggable
              isDragging={isDraggingItem(item.id)}
              onDragStart={(event) => onDragStartItem(item, event)}
              onDragEnd={onDragEnd}
              onToggle={canExpand ? () => onToggleExpanded(item.id) : undefined}
              onClick={() =>
                handleFolderRowClick({
                  folderId: item.id,
                  canExpand,
                  isExpanded,
                  isActive: isActiveFolder,
                  onOpenFolder,
                  onToggleExpanded,
                })
              }
              dropState={getFolderDropState(item.id)}
              onDragOver={(event) => {
                event.stopPropagation()
                onFolderDragOver(item.id, event)
              }}
              onDrop={(event) => {
                event.stopPropagation()
                onFolderDrop(item.id, event)
              }}
              onDragLeave={(event) => {
                event.stopPropagation()
                onFolderDragLeave(item.id)
              }}
            />

            {canExpand && isExpanded ? (
              <FolderChildren
                folderId={item.id}
                depth={depth + 1}
                highlightBranch={isActiveFolder}
                expandedIds={expandedIds}
                activeFolderId={activeFolderId}
                activePreviewId={activePreviewId}
                onToggleExpanded={onToggleExpanded}
                onOpenFolder={onOpenFolder}
                onOpenFile={onOpenFile}
                onDragStartItem={onDragStartItem}
                onDragEnd={onDragEnd}
                onFolderDragOver={onFolderDragOver}
                onFolderDrop={onFolderDrop}
                onFolderDragLeave={onFolderDragLeave}
                getFolderDropState={getFolderDropState}
                isDraggingItem={isDraggingItem}
              />
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}

export const DataroomSidebar = ({
  currentUser,
  activeFolderId,
  activePreviewId,
  expandedIds,
  onGoRoot,
  onNewFolder,
  onImportFile,
  onToggleExpanded,
  onOpenFolder,
  onOpenFile,
  onSignOut,
  onDragStartItem,
  onDragEnd,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  getFolderDropState,
  isDraggingItem,
}: DataroomSidebarProps) => {
  const isRootActive = normalizeFolderId(activeFolderId) === 'root'
  const isRootExpanded = expandedIds.has('root')
  const rootItemsQuery = useListContentItemsQuery('root', 'name', 'asc')
  const rootCanExpand = (rootItemsQuery.data?.items.length ?? 0) > 0
  const rootActiveVariant: ActiveVariant = isRootActive && Boolean(activePreviewId) ? 'context' : 'solid'
  const accountName = currentUser.displayName || currentUser.email || currentUser.firebaseUid
  const accountSubtitle = currentUser.displayName && currentUser.email ? currentUser.email : t('accountMember')
  const accountInitials = toInitials(accountName)
  const avatarColor = pickAvatarColor(currentUser.id || currentUser.firebaseUid || accountName)
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)
  const showPhotoAvatar = Boolean(currentUser.photoUrl) && failedPhotoUrl !== currentUser.photoUrl

  return (
    <Box h="100%" p="sm" pb={0} className="dataroom-sidebar">
      <Title order={5} px="xs" className="dataroom-sidebar__title">
        Data Room
      </Title>

      <Box className="dataroom-sidebar__quick-actions">
        <Button
          variant="subtle"
          size="xs"
          fullWidth
          className="dataroom-sidebar__quick-action-button"
          leftSection={<IconHome2 size={18} />}
          onClick={onGoRoot}
        >
          {t('goToRoot')}
        </Button>
        <Button
          variant="subtle"
          size="xs"
          fullWidth
          className="dataroom-sidebar__quick-action-button"
          leftSection={<IconFolderPlus size={18} />}
          onClick={onNewFolder}
        >
          {t('newFolder')}
        </Button>
        <Button
          variant="subtle"
          size="xs"
          fullWidth
          className="dataroom-sidebar__quick-action-button"
          leftSection={<IconUpload size={18} />}
          onClick={onImportFile}
        >
          {t('importFile')}
        </Button>
      </Box>

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
          canExpand={rootCanExpand}
          expanded={isRootExpanded}
          onToggle={rootCanExpand ? () => onToggleExpanded('root') : undefined}
          onClick={() =>
            handleFolderRowClick({
              folderId: 'root',
              canExpand: rootCanExpand,
              isExpanded: isRootExpanded,
              isActive: isRootActive,
              onOpenFolder,
              onToggleExpanded,
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
        />

        {rootCanExpand && expandedIds.has('root') ? (
          <FolderChildren
            folderId="root"
            depth={1}
            highlightBranch={isRootActive}
            expandedIds={expandedIds}
            activeFolderId={activeFolderId}
            activePreviewId={activePreviewId}
            onToggleExpanded={onToggleExpanded}
            onOpenFolder={onOpenFolder}
            onOpenFile={onOpenFile}
            onDragStartItem={onDragStartItem}
            onDragEnd={onDragEnd}
            onFolderDragOver={onFolderDragOver}
            onFolderDrop={onFolderDrop}
            onFolderDragLeave={onFolderDragLeave}
            getFolderDropState={getFolderDropState}
            isDraggingItem={isDraggingItem}
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
                      src={currentUser.photoUrl ?? undefined}
                      alt={accountName}
                      className="dataroom-sidebar__account-avatar-image"
                      onError={() => setFailedPhotoUrl(currentUser.photoUrl)}
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
    </Box>
  )
}
