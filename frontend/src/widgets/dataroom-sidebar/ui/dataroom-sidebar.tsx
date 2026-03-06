import { useMemo, useState } from 'react'
import { IconChevronDown, IconChevronRight, IconFile, IconFolder } from '@tabler/icons-react'

import { isFileItem } from '@/entities/content-item'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { normalizeFolderId } from '@/shared/routes/dataroom-routes'
import { Box, Group, ScrollArea, Text, Title } from '@/shared/ui'
import './dataroom-sidebar.css'

type DataroomSidebarProps = {
  activeFolderId: string
  activePreviewId: string | null
  expandedPathIds: string[]
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string) => void
}

type FolderChildrenProps = {
  folderId: string
  depth: number
  expandedIds: Set<string>
  activeFolderId: string
  activePreviewId: string | null
  onToggleExpanded: (folderId: string) => void
  onOpenFolder: (folderId: string) => void
  onOpenFile: (fileId: string, parentFolderId: string) => void
}

const TreeRow = ({
  depth,
  active,
  isFile,
  name,
  onClick,
  expanded,
  canExpand,
  onToggle,
}: {
  depth: number
  active: boolean
  isFile: boolean
  name: string
  onClick: () => void
  expanded?: boolean
  canExpand?: boolean
  onToggle?: () => void
}) => (
  <Group
    className={active ? 'sidebar-tree-row sidebar-tree-row--active' : 'sidebar-tree-row'}
    gap={8}
    px="sm"
    py={6}
    wrap="nowrap"
    style={{
      marginLeft: depth * 12,
    }}
    onClick={onClick}
  >
    {canExpand ? (
      <Box
        onClick={(event) => {
          event.stopPropagation()
          onToggle?.()
        }}
        style={{ display: 'inline-flex', cursor: 'pointer' }}
      >
        {expanded ? <IconChevronDown size={14} color="#6d7588" /> : <IconChevronRight size={14} color="#6d7588" />}
      </Box>
    ) : (
      <Box style={{ width: 14 }} />
    )}

    {isFile ? <IconFile size={16} color="#667085" /> : <IconFolder size={16} color="#2f6fed" />}

    <Text size="sm" fw={active ? 600 : 500} c={active ? '#2f6fed' : 'var(--text-primary)'}>
      {name}
    </Text>
  </Group>
)

const FolderChildren = ({
  folderId,
  depth,
  expandedIds,
  activeFolderId,
  activePreviewId,
  onToggleExpanded,
  onOpenFolder,
  onOpenFile,
}: FolderChildrenProps) => {
  const query = useListContentItemsQuery(folderId, 'name', 'asc')

  if (query.isPending) {
    return (
      <Text size="xs" c="dimmed" px="sm" py={4} style={{ marginLeft: depth * 12 }}>
        Loading...
      </Text>
    )
  }

  if (query.error) {
    return (
      <Text size="xs" c="red" px="sm" py={4} style={{ marginLeft: depth * 12 }}>
        Failed to load
      </Text>
    )
  }

  return (
    <>
      {query.data?.items.map((item) => {
        if (isFileItem(item)) {
          const isActiveFile = activePreviewId === item.id && activeFolderId === folderId
          return (
            <TreeRow
              key={item.id}
              depth={depth}
              active={isActiveFile}
              isFile
              name={item.name}
              onClick={() => onOpenFile(item.id, folderId)}
            />
          )
        }

        const isExpanded = expandedIds.has(item.id)
        const isActiveFolder = normalizeFolderId(activeFolderId) === item.id

        return (
          <Box key={item.id}>
            <TreeRow
              depth={depth}
              active={isActiveFolder}
              isFile={false}
              name={item.name}
              canExpand
              expanded={isExpanded}
              onToggle={() => onToggleExpanded(item.id)}
              onClick={() => {
                onOpenFolder(item.id)
                if (!isExpanded) {
                  onToggleExpanded(item.id)
                }
              }}
            />

            {isExpanded ? (
              <FolderChildren
                folderId={item.id}
                depth={depth + 1}
                expandedIds={expandedIds}
                activeFolderId={activeFolderId}
                activePreviewId={activePreviewId}
                onToggleExpanded={onToggleExpanded}
                onOpenFolder={onOpenFolder}
                onOpenFile={onOpenFile}
              />
            ) : null}
          </Box>
        )
      })}
    </>
  )
}

export const DataroomSidebar = ({
  activeFolderId,
  activePreviewId,
  expandedPathIds,
  onOpenFolder,
  onOpenFile,
}: DataroomSidebarProps) => {
  const [userExpandedIds, setUserExpandedIds] = useState<Set<string>>(() => new Set(['root']))

  const normalizedExpandedPath = useMemo(
    () => expandedPathIds.map((id) => normalizeFolderId(id)).filter((id) => id !== 'root'),
    [expandedPathIds],
  )

  const expandedIds = useMemo(() => {
    const next = new Set(userExpandedIds)
    next.add('root')
    next.add(normalizeFolderId(activeFolderId))
    normalizedExpandedPath.forEach((id) => next.add(id))
    return next
  }, [activeFolderId, normalizedExpandedPath, userExpandedIds])

  const onToggleExpanded = (folderId: string) => {
    setUserExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  return (
    <Box h="100%" p="sm">
      <Title order={5} px="xs" py="xs">
        Data Room
      </Title>

      <ScrollArea h="calc(100% - 38px)">
        <TreeRow
          depth={0}
          active={normalizeFolderId(activeFolderId) === 'root'}
          isFile={false}
          name="Data Room"
          canExpand
          expanded={expandedIds.has('root')}
          onToggle={() => onToggleExpanded('root')}
          onClick={() => onOpenFolder('root')}
        />

        {expandedIds.has('root') ? (
          <FolderChildren
            folderId="root"
            depth={1}
            expandedIds={expandedIds}
            activeFolderId={activeFolderId}
            activePreviewId={activePreviewId}
            onToggleExpanded={onToggleExpanded}
            onOpenFolder={onOpenFolder}
            onOpenFile={onOpenFile}
          />
        ) : null}
      </ScrollArea>
    </Box>
  )
}
