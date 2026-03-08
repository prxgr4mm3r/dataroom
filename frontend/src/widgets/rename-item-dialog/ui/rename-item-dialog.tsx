import { useEffect, useState } from 'react'

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

export const RenameItemDialog = ({ opened, item, onClose }: RenameItemDialogProps) => {
  const [name, setName] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const renameItemMutation = useRenameItem()
  const { reset } = renameItemMutation

  useEffect(() => {
    if (!opened || !item) {
      setName('')
      setInlineError(null)
      reset()
      return
    }

    setName(item.name)
    setInlineError(null)
    reset()
  }, [item, opened, reset])

  const handleClose = () => {
    setName('')
    setInlineError(null)
    reset()
    onClose()
  }

  const onSubmit = async () => {
    if (!item) {
      return
    }

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
