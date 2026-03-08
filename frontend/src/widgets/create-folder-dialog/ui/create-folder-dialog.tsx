import { useState } from 'react'

import { useCreateFolder } from '@/features/create-folder'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { toNullableFolderId } from '@/shared/routes/dataroom-routes'
import { Alert, Button, Group, Modal, Stack, TextInput } from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'

type CreateFolderDialogProps = {
  opened: boolean
  folderId: string
  onClose: () => void
}

export const CreateFolderDialog = ({ opened, folderId, onClose }: CreateFolderDialogProps) => {
  const [name, setName] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const createFolderMutation = useCreateFolder()

  const handleClose = () => {
    setName('')
    setInlineError(null)
    createFolderMutation.reset()
    onClose()
  }

  const onSubmit = async () => {
    if (!name.trim()) {
      setInlineError(t('folderNameRequired'))
      return
    }

    setInlineError(null)

    try {
      await createFolderMutation.mutateAsync({
        name: name.trim(),
        parent_id: toNullableFolderId(folderId),
      })
      notifySuccess(t('folderCreatedSuccess'))
      handleClose()
    } catch (error) {
      const message = toApiError(error).message
      setInlineError(message)
      notifyError(message)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t('createFolderTitle')}
      styles={{
        header: {
          padding: '10px 14px',
          minHeight: 0,
        },
        body: {
          paddingTop: '18px',
        },
        title: {
          fontSize: '0.95rem',
        },
      }}
    >
      <Stack>
        <TextInput
          data-autofocus
          label={t('folderNameLabel')}
          placeholder={t('folderNamePlaceholder')}
          styles={{
            label: {
              marginBottom: '6px',
            },
          }}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onSubmit()
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              handleClose()
            }
          }}
        />

        {inlineError ? <Alert color="red">{inlineError}</Alert> : null}

        <Group grow wrap="nowrap" gap="xs">
          <Button variant="default" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void onSubmit()} loading={createFolderMutation.isPending}>
            {t('create')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
