import { useMemo, useState } from 'react'

import { useGoogleFilesQuery } from '@/features/browse-google-files'
import { useGoogleStatusQuery } from '@/features/check-google-status'
import { useGoogleConnect } from '@/features/connect-google-drive'
import { useImportFileFromGoogle } from '@/features/import-file-from-google'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'

type ImportFileDialogProps = {
  opened: boolean
  folderId: string
  onClose: () => void
}

export const ImportFileDialog = ({ opened, folderId, onClose }: ImportFileDialogProps) => {
  const [search, setSearch] = useState('')

  const googleStatusQuery = useGoogleStatusQuery(opened)
  const googleConnect = useGoogleConnect()
  const importMutation = useImportFileFromGoogle(folderId)

  const canBrowseGoogleFiles = Boolean(
    opened && googleStatusQuery.data?.connected && !googleStatusQuery.data?.tokenExpired,
  )
  const googleFilesQuery = useGoogleFilesQuery(canBrowseGoogleFiles, search)

  const canImport = useMemo(
    () => googleStatusQuery.data?.connected && !googleStatusQuery.data?.tokenExpired,
    [googleStatusQuery.data],
  )

  const handleImport = async (googleFileId: string) => {
    try {
      await importMutation.mutateAsync({
        google_file_id: googleFileId,
        target_folder_id: folderId === 'root' ? null : folderId,
      })
      notifySuccess('File imported successfully')
      onClose()
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t('importFile')} size="xl">
      <Tabs defaultValue="google">
        <Tabs.List>
          <Tabs.Tab value="google">{t('importFromGoogle')}</Tabs.Tab>
          <Tabs.Tab value="upload">{t('uploadFromComputer')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="google" pt="md">
          <Stack gap="sm">
            {googleStatusQuery.isPending ? <Loader size="sm" /> : null}

            {googleStatusQuery.data?.connected && googleStatusQuery.data.tokenExpired ? (
              <Alert color="orange">{t('googleReconnectRequired')}</Alert>
            ) : null}

            {!googleStatusQuery.data?.connected ? <Alert color="yellow">{t('googleNotConnected')}</Alert> : null}

            {!canImport ? (
              <Button loading={googleConnect.isPending} onClick={() => googleConnect.mutate()}>
                {t('connectGoogle')}
              </Button>
            ) : (
              <>
                <TextInput
                  placeholder="Search Google Drive files"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                />

                {googleFilesQuery.isPending ? <Loader size="sm" /> : null}

                {googleFilesQuery.error ? (
                  <Alert color="red">{toApiError(googleFilesQuery.error).message}</Alert>
                ) : null}

                <ScrollArea h={320}>
                  <Stack gap={6}>
                    {googleFilesQuery.data?.files.map((file) => (
                      <Group
                        key={file.id}
                        justify="space-between"
                        p="xs"
                        style={{ border: '1px solid var(--border-soft)', borderRadius: 8 }}
                      >
                        <div>
                          <Text size="sm" fw={600}>
                            {file.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {file.mime_type || 'Unknown type'} • {formatFileSize(file.size_bytes)}
                          </Text>
                        </div>
                        <Button
                          size="xs"
                          loading={importMutation.isPending}
                          onClick={() => void handleImport(file.id)}
                        >
                          Import
                        </Button>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea>
              </>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="upload" pt="md">
          <Alert color="blue">{t('uploadComingSoon')}</Alert>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  )
}
