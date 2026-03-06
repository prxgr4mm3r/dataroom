import { IconFolder } from '@tabler/icons-react'

import type { FolderNode } from '@/entities/folder'
import { t } from '@/shared/i18n/messages'
import { Alert, Box, Button, Group, Modal, ScrollArea, Stack, Text } from '@/shared/ui'
import './folder-picker-dialog.css'

type FolderPickerDialogProps = {
  opened: boolean
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  targetFolderId: string
  folderTree: FolderNode | undefined
  error: string | null
  getTargetError: (folderId: string) => string | null
  onSelectFolder: (folderId: string) => void
  onConfirm: () => void
  onClose: () => void
}

const FolderRow = ({
  node,
  depth,
  selected,
  invalid,
  onClick,
}: {
  node: FolderNode
  depth: number
  selected: boolean
  invalid: boolean
  onClick: () => void
}) => {
  const className = [
    'folder-picker-node',
    selected ? 'folder-picker-node--selected' : '',
    invalid ? 'folder-picker-node--invalid' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Group className={className} px="sm" py={6} gap={8} wrap="nowrap" style={{ marginLeft: depth * 12 }} onClick={onClick}>
      <IconFolder size={15} color={invalid ? '#e03131' : '#2f6fed'} />
      <Text size="sm" c={invalid ? 'red' : undefined}>
        {node.name}
      </Text>
    </Group>
  )
}

const FolderTree = ({
  node,
  depth,
  targetFolderId,
  getTargetError,
  onSelectFolder,
}: {
  node: FolderNode
  depth: number
  targetFolderId: string
  getTargetError: (folderId: string) => string | null
  onSelectFolder: (folderId: string) => void
}) => {
  const invalid = Boolean(getTargetError(node.id))

  return (
    <>
      <FolderRow
        node={node}
        depth={depth}
        selected={targetFolderId === node.id}
        invalid={invalid}
        onClick={() => onSelectFolder(node.id)}
      />

      {node.children.map((child) => (
        <FolderTree
          key={child.id}
          node={child}
          depth={depth + 1}
          targetFolderId={targetFolderId}
          getTargetError={getTargetError}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </>
  )
}

export const FolderPickerDialog = ({
  opened,
  title,
  description,
  confirmLabel,
  pending,
  targetFolderId,
  folderTree,
  error,
  getTargetError,
  onSelectFolder,
  onConfirm,
  onClose,
}: FolderPickerDialogProps) => {
  const targetError = getTargetError(targetFolderId)

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg">
      <Stack>
        <Text size="sm">{description}</Text>
        <Text size="xs" c="dimmed">
          {t('pickDestination')}
        </Text>

        <Box style={{ border: '1px solid var(--border-soft)', borderRadius: 10 }}>
          <ScrollArea h={300}>
            {folderTree ? (
              <FolderTree
                node={folderTree}
                depth={0}
                targetFolderId={targetFolderId}
                getTargetError={getTargetError}
                onSelectFolder={onSelectFolder}
              />
            ) : (
              <Text p="sm" size="sm" c="dimmed">
                Loading folders...
              </Text>
            )}
          </ScrollArea>
        </Box>

        {targetError ? <Alert color="orange">{targetError}</Alert> : null}
        {error ? <Alert color="red">{error}</Alert> : null}

        <Group justify="end" gap="xs">
          <Button variant="default" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={onConfirm} loading={pending} disabled={Boolean(targetError)}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
