import { useState } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { useRenameItem } from '@/features/rename-content-items'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { Alert, Button, Group, Modal, Stack, TextInput } from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'

type RenameItemDialogProps = {
  opened: boolean
  item: ContentItem | null
  onClose: () => void
}

type RenameItemDialogInnerProps = {
  opened: boolean
  item: ContentItem
  onClose: () => void
}

const RenameItemDialogInner = ({ opened, item, onClose }: RenameItemDialogInnerProps) => {
  const [name, setName] = useState(item.name)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const renameItemMutation = useRenameItem()
  const { reset } = renameItemMutation

  const handleClose = () => {
    setInlineError(null)
    reset()
    onClose()
  }

  const onSubmit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setInlineError(t('itemNameRequired'))
      return
    }

    if (trimmedName === item.name) {
      handleClose()
      return
    }

    setInlineError(null)

    try {
      await renameItemMutation.mutateAsync({
        itemId: item.id,
        name: trimmedName,
      })
      notifySuccess(t('renameItemSuccess'))
      handleClose()
    } catch (error) {
      const message = toApiError(error).message
      setInlineError(message)
      notifyError(message)
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title={t('renameItemTitle')}>
      <Stack>
        <TextInput
          label={t('itemNameLabel')}
          placeholder={t('itemNamePlaceholder')}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onSubmit()
            }
          }}
          autoFocus
        />

        {inlineError ? <Alert color="red">{inlineError}</Alert> : null}

        <Group grow wrap="nowrap" gap="xs">
          <Button variant="default" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void onSubmit()} loading={renameItemMutation.isPending}>
            {t('rename')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export const RenameItemDialog = ({ opened, item, onClose }: RenameItemDialogProps) => {
  if (!item) {
    return <Modal opened={opened} onClose={onClose} title={t('renameItemTitle')} />
  }

  return <RenameItemDialogInner key={`${item.id}:${opened ? 'open' : 'closed'}`} opened={opened} item={item} onClose={onClose} />
}
