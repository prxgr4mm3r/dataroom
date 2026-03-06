import { t } from '@/shared/i18n/messages'
import { Button, Group, Text } from '@/shared/ui'

type BulkActionsBarProps = {
  selectedCount: number
  onClearSelection: () => void
  onDeleteSelected: () => void
  deletePending: boolean
}

export const BulkActionsBar = ({
  selectedCount,
  onClearSelection,
  onDeleteSelected,
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
        <Button variant="default" size="xs" disabled>
          {t('copy')}
        </Button>
        <Button variant="default" size="xs" disabled>
          {t('move')}
        </Button>
        <Button color="red" variant="light" size="xs" onClick={onDeleteSelected} loading={deletePending}>
          {t('deleteSelected')}
        </Button>
        <Button variant="subtle" size="xs" onClick={onClearSelection}>
          {t('clearSelection')}
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        {t('deleteNextIteration')}
      </Text>
    </Group>
  )
}
