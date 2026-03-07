import { useMemo, useRef, useState, type DragEvent } from 'react'

import { useGoogleFilesQuery } from '@/features/browse-google-files'
import { useGoogleStatusQuery } from '@/features/check-google-status'
import { useGoogleConnect } from '@/features/connect-google-drive'
import { useImportFileFromGoogle } from '@/features/import-file-from-google'
import { useUploadFileFromDevice } from '@/features/upload-file-from-device'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import {
  getImportFileTooLargeMessage,
  isImportFileTooLarge,
} from '@/shared/lib/file/import-file-size-limit'
import { toNullableFolderId } from '@/shared/routes/dataroom-routes'
import {
  Alert,
  Box,
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
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const googleStatusQuery = useGoogleStatusQuery(opened)
  const googleConnect = useGoogleConnect()
  const importMutation = useImportFileFromGoogle(folderId)
  const uploadMutation = useUploadFileFromDevice(folderId)

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
        target_folder_id: toNullableFolderId(folderId),
      })
      notifySuccess('File imported successfully')
      onClose()
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

  const handleLocalUpload = async (file: File | null | undefined) => {
    if (!file) {
      setUploadError(t('uploadNoFile'))
      return
    }

    if (isImportFileTooLarge(file)) {
      const message = getImportFileTooLargeMessage()
      setUploadError(message)
      notifyError(message)
      return
    }

    setUploadError(null)

    try {
      await uploadMutation.mutateAsync({
        file,
        targetFolderId: toNullableFolderId(folderId),
      })
      notifySuccess(t('fileUploadedSuccess'))
      onClose()
    } catch (error) {
      const message = toApiError(error).message
      setUploadError(message)
      notifyError(message)
    }
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    await handleLocalUpload(file)
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
          <Stack gap="sm">
            <Box
              onDragOver={(event) => {
                event.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => void handleDrop(event)}
              p="xl"
              style={{
                border: `2px dashed ${dragActive ? '#2f6fed' : 'var(--border-soft)'}`,
                borderRadius: 12,
                background: dragActive ? '#edf2ff' : 'var(--bg-subtle)',
                textAlign: 'center',
              }}
            >
              <Stack gap="xs" align="center">
                <Text size="sm">{t('uploadFileHint')}</Text>
                <Group>
                  <Button
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploadMutation.isPending}
                  >
                    {t('chooseFile')}
                  </Button>
                </Group>
              </Stack>

              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  void handleLocalUpload(file)
                  event.currentTarget.value = ''
                }}
              />
            </Box>

            {uploadError ? <Alert color="red">{uploadError}</Alert> : null}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  )
}
