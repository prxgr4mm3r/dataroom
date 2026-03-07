import { t } from '@/shared/i18n/messages'
import { Button, Group, Text } from '@/shared/ui'

type BulkActionsBarProps = {
  mode?: 'full' | 'download_only'
  selectedCount: number
  onClearSelection: () => void
  onDownloadSelected: () => void
  onCopySelected?: () => void
  onMoveSelected?: () => void
  onDeleteSelected?: () => void
  downloadPending: boolean
  copyPending?: boolean
  movePending?: boolean
  deletePending?: boolean
}

export const BulkActionsBar = ({
  mode = 'full',
  selectedCount,
  onClearSelection,
  onDownloadSelected,
  onCopySelected,
  onMoveSelected,
  onDeleteSelected,
  downloadPending,
  copyPending = false,
  movePending = false,
  deletePending = false,
}: BulkActionsBarProps) => {
  if (selectedCount < 1) {
    return <Group h="100%" px="md" />
  }

  if (mode === 'download_only') {
    return (
      <Group h="100%" px="md" justify="space-between">
        <Text size="sm">
          {t('selectedCount')}: {selectedCount}
        </Text>
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={onDownloadSelected} loading={downloadPending}>
            {t('download')}
          </Button>
          <Button variant="subtle" size="xs" onClick={onClearSelection}>
            {t('clearSelection')}
          </Button>
        </Group>
      </Group>
    )
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
        {onCopySelected ? (
          <Button variant="default" size="xs" onClick={onCopySelected} loading={copyPending}>
            {t('copy')}
          </Button>
        ) : null}
        {onMoveSelected ? (
          <Button variant="default" size="xs" onClick={onMoveSelected} loading={movePending}>
            {t('move')}
          </Button>
        ) : null}
        {onDeleteSelected ? (
          <Button color="red" variant="light" size="xs" onClick={onDeleteSelected} loading={deletePending}>
            {t('deleteSelected')}
          </Button>
        ) : null}
        <Button variant="subtle" size="xs" onClick={onClearSelection}>
          {t('clearSelection')}
        </Button>
      </Group>
    </Group>
  )
}
