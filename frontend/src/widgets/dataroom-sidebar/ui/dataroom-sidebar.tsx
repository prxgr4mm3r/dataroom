import { IconChevronRight, IconFolder } from '@tabler/icons-react'

import type { FolderNode } from '@/entities/folder'
import { normalizeFolderId } from '@/shared/routes/dataroom-routes'
import { Box, Group, ScrollArea, Text, Title } from '@/shared/ui'

type DataroomSidebarProps = {
  tree: FolderNode | undefined
  activeFolderId: string
  onOpenFolder: (folderId: string) => void
}

const FolderTreeItem = ({
  node,
  depth,
  activeFolderId,
  onOpenFolder,
}: {
  node: FolderNode
  depth: number
  activeFolderId: string
  onOpenFolder: (folderId: string) => void
}) => {
  const normalizedId = normalizeFolderId(node.id)
  const isActive = normalizeFolderId(activeFolderId) === normalizedId

  return (
    <Box>
      <Group
        gap={8}
        px="sm"
        py={6}
        style={{
          cursor: 'pointer',
          borderRadius: 8,
          marginLeft: depth * 12,
          background: isActive ? '#e9edf8' : 'transparent',
        }}
        onClick={() => onOpenFolder(normalizedId)}
      >
        <IconFolder size={16} color={isActive ? '#2f6fed' : '#6d7588'} />
        <Text size="sm" fw={isActive ? 600 : 500} c={isActive ? '#2f6fed' : 'var(--text-primary)'}>
          {node.name}
        </Text>
      </Group>

      {node.children.map((child) => (
        <FolderTreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          activeFolderId={activeFolderId}
          onOpenFolder={onOpenFolder}
        />
      ))}
    </Box>
  )
}

export const DataroomSidebar = ({ tree, activeFolderId, onOpenFolder }: DataroomSidebarProps) => (
  <Box h="100%" p="sm">
    <Title order={5} px="xs" py="xs">
      Data Room
    </Title>
    <ScrollArea h="calc(100% - 38px)">
      {tree ? (
        <>
          <Group
            gap={8}
            px="sm"
            py={6}
            style={{
              cursor: 'pointer',
              borderRadius: 8,
              background: normalizeFolderId(activeFolderId) === 'root' ? '#e9edf8' : 'transparent',
            }}
            onClick={() => onOpenFolder('root')}
          >
            <IconChevronRight size={14} color="#6d7588" />
            <IconFolder size={16} color="#2f6fed" />
            <Text size="sm" fw={600}>
              Data Room
            </Text>
          </Group>

          {tree.children.map((node) => (
            <FolderTreeItem
              key={node.id}
              node={node}
              depth={1}
              activeFolderId={activeFolderId}
              onOpenFolder={onOpenFolder}
            />
          ))}
        </>
      ) : (
        <Text size="sm" c="dimmed" px="sm" py="sm">
          Loading folders...
        </Text>
      )}
    </ScrollArea>
  </Box>
)
