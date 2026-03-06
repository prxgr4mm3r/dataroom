import { t } from '@/shared/i18n/messages'
import { Alert, Button, Group, Modal, Stack, Text } from '@/shared/ui'

type DeleteItemsDialogProps = {
  opened: boolean
  title: string
  message: string
  pending: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

export const DeleteItemsDialog = ({
  opened,
  title,
  message,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteItemsDialogProps) => (
  <Modal opened={opened} onClose={onClose} title={title}>
    <Stack>
      <Text size="sm">{message}</Text>
      {error ? <Alert color="red">{error}</Alert> : null}
      <Group justify="end" gap="xs">
        <Button variant="default" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button color="red" onClick={onConfirm} loading={pending}>
          {t('deleteConfirm')}
        </Button>
      </Group>
    </Stack>
  </Modal>
)
