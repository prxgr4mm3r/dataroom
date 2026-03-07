import { t } from '@/shared/i18n/messages'
import { Button, Group, Text } from '@/shared/ui'

type BulkActionsBarProps = {
  selectedCount: number
  onClearSelection: () => void
  onDownloadSelected: () => void
  onCopySelected: () => void
  onMoveSelected: () => void
  onDeleteSelected: () => void
  downloadPending: boolean
  copyPending: boolean
  movePending: boolean
  deletePending: boolean
}

export const BulkActionsBar = ({
  selectedCount,
  onClearSelection,
  onDownloadSelected,
  onCopySelected,
  onMoveSelected,
  onDeleteSelected,
  downloadPending,
  copyPending,
  movePending,
  deletePending,
}: BulkActionsBarProps) => {
  if (selectedCount < 1) {
    return <Group h="100%" px="md" />
  }

  return (
    <Group h="100%" px="md" justify="space-between">
      <Text size="sm">
        {t('selectedCount')}: {selectedCount}
      </Text>
      <Group gap="xs">
        <Button variant="default" size="xs" onClick={onDownloadSelected} loading={downloadPending}>
          {t('download')}
        </Button>
        <Button variant="default" size="xs" onClick={onCopySelected} loading={copyPending}>
          {t('copy')}
        </Button>
        <Button variant="default" size="xs" onClick={onMoveSelected} loading={movePending}>
          {t('move')}
        </Button>
        <Button color="red" variant="light" size="xs" onClick={onDeleteSelected} loading={deletePending}>
          {t('deleteSelected')}
        </Button>
        <Button variant="subtle" size="xs" onClick={onClearSelection}>
          {t('clearSelection')}
        </Button>
      </Group>
    </Group>
  )
}
