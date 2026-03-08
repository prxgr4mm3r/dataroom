import { IconLogout2, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useGoogleFilesQuery } from '@/features/browse-google-files'
import type { GoogleFilesOrderBy, GoogleFilesSource } from '@/features/browse-google-files/api/get-google-files'
import { useGoogleStatusQuery } from '@/features/check-google-status'
import { useGoogleConnect } from '@/features/connect-google-drive'
import { useGoogleDisconnect } from '@/features/disconnect-google-drive'
import type { DragImportFailure, DragImportResult } from '@/features/drag-import-files'
import { useImportFileFromGoogle } from '@/features/import-file-from-google'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { formatDateCompact } from '@/shared/lib/date/format-date'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { MAX_IMPORT_FILE_SIZE_BYTES } from '@/shared/lib/file/import-file-size-limit'
import { toNullableFolderId } from '@/shared/routes/dataroom-routes'
import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  ScrollArea,
  SelectionCheckbox,
  Stack,
  Text,
  TextInput,
  FileTypeIcon,
} from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'
import './import-file-dialog.css'

type ImportFileDialogProps = {
  opened: boolean
  folderId: string
  onClose: () => void
  onPartialImportResult?: (result: DragImportResult) => void
}

const GOOGLE_DRIVE_LOGO_SRC = '/logo_drive.png'

const GoogleDriveLogo = ({ className }: { className?: string }) => (
  <img src={GOOGLE_DRIVE_LOGO_SRC} alt="" aria-hidden="true" className={className} draggable={false} />
)

const splitFileNameForEllipsis = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return { baseName: fileName, extension: '' }
  }

  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  }
}

export const ImportFileDialog = ({
  opened,
  folderId,
  onClose,
  onPartialImportResult,
}: ImportFileDialogProps) => {
  const [search, setSearch] = useState('')
  const [driveTab, setDriveTab] = useState<GoogleFilesSource>('recent')
  const [driveSort, setDriveSort] = useState<GoogleFilesOrderBy>('modified_desc')
  const [selectedGoogleIds, setSelectedGoogleIds] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const googleStatusQuery = useGoogleStatusQuery(opened)
  const googleConnect = useGoogleConnect()
  const googleDisconnect = useGoogleDisconnect()
  const importMutation = useImportFileFromGoogle(folderId)

  const googleStatus = googleStatusQuery.data
  const isGoogleConnected = googleStatus?.connected === true
  const connectedGoogleEmail = isGoogleConnected ? googleStatus.googleEmail : null
  const tokenExpired = isGoogleConnected ? googleStatus.tokenExpired : false
  const canImport = isGoogleConnected && !tokenExpired
  const canBrowseGoogleFiles = Boolean(opened && canImport)
  const googleFilesQuery = useGoogleFilesQuery(canBrowseGoogleFiles, search, driveTab, driveSort)
  const visibleGoogleFiles = useMemo(() => googleFilesQuery.data?.files ?? [], [googleFilesQuery.data?.files])
  const visibleGoogleIds = useMemo(
    () => new Set(visibleGoogleFiles.map((file) => file.id)),
    [visibleGoogleFiles],
  )
  const visibleGoogleFileNames = useMemo(
    () => new Map(visibleGoogleFiles.map((file) => [file.id, file.name])),
    [visibleGoogleFiles],
  )
  const visibleGoogleFilesById = useMemo(
    () => new Map(visibleGoogleFiles.map((file) => [file.id, file])),
    [visibleGoogleFiles],
  )
  const effectiveSelectedGoogleIds = useMemo(
    () => selectedGoogleIds.filter((id) => visibleGoogleIds.has(id)),
    [selectedGoogleIds, visibleGoogleIds],
  )
  const importableSelectedGoogleIds = useMemo(
    () =>
      effectiveSelectedGoogleIds.filter((id) => {
        const file = visibleGoogleFilesById.get(id)
        if (!file) {
          return false
        }
        return (file.size_bytes ?? 0) <= MAX_IMPORT_FILE_SIZE_BYTES
      }),
    [effectiveSelectedGoogleIds, visibleGoogleFilesById],
  )
  const effectiveSelectedGoogleIdSet = useMemo(
    () => new Set(importableSelectedGoogleIds),
    [importableSelectedGoogleIds],
  )

  const importPickedFiles = async (googleFileIds: string[]) => {
    if (!googleFileIds.length) {
      return
    }

    const uploadedFiles: string[] = []
    const failedFiles: DragImportFailure[] = []

    for (const googleFileId of googleFileIds) {
      const fileName = visibleGoogleFileNames.get(googleFileId) ?? 'Unknown file'
      try {
        await importMutation.mutateAsync({
          google_file_id: googleFileId,
          target_folder_id: toNullableFolderId(folderId),
        })
        uploadedFiles.push(fileName)
      } catch (error) {
        const message = toApiError(error).message
        const normalizedMessage = message.toLowerCase()
        const reason: DragImportFailure['reason'] =
          normalizedMessage.includes('size limit') ||
          normalizedMessage.includes('too large') ||
          normalizedMessage.includes('exceeds')
            ? 'too_large'
            : 'upload_failed'

        failedFiles.push({
          fileName,
          message,
          reason,
        })
      }
    }

    const importedCount = uploadedFiles.length
    const failedCount = failedFiles.length
    const firstErrorMessage = failedFiles[0]?.message ?? null
    const result: DragImportResult = {
      uploadedCount: importedCount,
      failedCount,
      uploadedFiles,
      failedFiles,
      firstErrorMessage,
      hasPartialFailures: importedCount > 0 && failedCount > 0,
      allRejectedBySizeLimit: importedCount === 0 && failedCount > 0 && failedFiles.every((file) => file.reason === 'too_large'),
    }

    onClose()

    if (result.hasPartialFailures && onPartialImportResult) {
      onPartialImportResult(result)
      return
    }

    if (importedCount > 0 && failedCount === 0) {
      notifySuccess(
        importedCount === 1
          ? '1 file imported successfully.'
          : `${importedCount} files imported successfully.`,
      )
      return
    }

    if (failedCount > 0) {
      notifyError(
        failedCount === 1 ? firstErrorMessage || 'Failed to import selected file.' : `${failedCount} files failed to import.`,
      )
    }
  }

  const toggleGoogleSelection = (googleFileId: string) => {
    setSelectedGoogleIds((currentIds) =>
      currentIds.includes(googleFileId)
        ? currentIds.filter((id) => id !== googleFileId)
        : [...currentIds, googleFileId],
    )
  }

  const handleDriveTabChange = (nextTab: GoogleFilesSource) => {
    setDriveTab(nextTab)
    setSelectedGoogleIds([])
    if (nextTab === 'my_drive') {
      setDriveSort('name_asc')
    } else {
      setDriveSort('modified_desc')
    }
  }

  const headerStatusTone = googleStatusQuery.isPending
    ? 'loading'
    : tokenExpired
      ? 'warning'
      : isGoogleConnected
        ? 'connected'
        : 'disconnected'

  const headerStatusLabel = googleStatusQuery.isPending
    ? 'Checking Google Drive...'
    : tokenExpired
      ? 'Reconnect required'
      : isGoogleConnected
        ? 'Connected'
        : 'Not connected'
  const showHeaderStatusLabel = !isGoogleConnected || tokenExpired || googleStatusQuery.isPending || !connectedGoogleEmail
  const showHeaderStatusRow = googleStatusQuery.isPending || (isGoogleConnected && !tokenExpired)

  const handleDisconnect = () => {
    if (googleDisconnect.isPending) {
      return
    }

    googleDisconnect.mutate(undefined, {
      onSuccess: () => {
        setSelectedGoogleIds([])
        notifySuccess(t('googleDisconnectedSuccess'))
      },
      onError: (error) => {
        notifyError(toApiError(error).message)
      },
    })
  }

  useEffect(() => {
    if (!opened || !canImport) {
      return
    }

    const rafId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [opened, canImport])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Box className="import-file-dialog__modal-header">
          <Group wrap="nowrap" gap="sm" className="import-file-dialog__modal-header-main">
            <Text className="import-file-dialog__modal-title" fw={700}>
              Import from Google Drive
            </Text>
          </Group>

          {showHeaderStatusRow ? (
            <Group
              gap={6}
              wrap="nowrap"
              className={[
                'import-file-dialog__header-status-row',
                `import-file-dialog__header-status-row--${headerStatusTone}`,
              ].join(' ')}
            >
              <GoogleDriveLogo className="import-file-dialog__drive-glyph import-file-dialog__drive-glyph--inline" />
              {showHeaderStatusLabel ? (
                <Text
                  size="xs"
                  fw={600}
                  className={[
                    'import-file-dialog__header-status',
                    `import-file-dialog__header-status--${headerStatusTone}`,
                  ].join(' ')}
                >
                  {headerStatusLabel}
                </Text>
              ) : null}
              {connectedGoogleEmail ? (
                <Text size="xs" truncate="end" className="import-file-dialog__status-email">
                  {connectedGoogleEmail}
                </Text>
              ) : null}
              {isGoogleConnected && !tokenExpired ? (
                <button
                  type="button"
                  className="import-file-dialog__header-disconnect"
                  disabled={googleDisconnect.isPending || googleConnect.isPending}
                  onClick={handleDisconnect}
                >
                  {googleDisconnect.isPending ? (
                    'Disconnecting...'
                  ) : (
                    <>
                      <IconLogout2 size={12} stroke={1.9} aria-hidden="true" />
                      <span>{t('disconnectGoogle')}</span>
                    </>
                  )}
                </button>
              ) : null}
            </Group>
          ) : null}
        </Box>
      }
      size={!canImport ? 'md' : 'xl'}
      centered
      classNames={{
        content: [
          'import-file-dialog__modal-content',
          !canImport ? 'import-file-dialog__modal-content--compact' : '',
        ]
          .filter(Boolean)
          .join(' '),
        body: [
          'import-file-dialog__modal-body',
          !canImport ? 'import-file-dialog__modal-body--compact' : '',
        ]
          .filter(Boolean)
          .join(' '),
        header: 'import-file-dialog__modal-shell-header',
        close: 'import-file-dialog__modal-close',
      }}
    >
      <Stack className="import-file-dialog" gap="md">
        <Stack
          gap="sm"
          className={['import-file-dialog__main', !canImport ? 'import-file-dialog__main--compact' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {googleStatusQuery.isPending ? (
            <Box className="import-file-dialog__state-card">
              <Group gap={8}>
                <Loader size="sm" />
                <Text size="sm">Checking Google Drive connection...</Text>
              </Group>
            </Box>
          ) : null}

          {!canImport ? (
            tokenExpired ? (
              <Stack className="import-file-dialog__reconnect-panel" gap="md">
                <Stack gap={5}>
                  <Text size="md" fw={700}>
                    Reconnect Google Drive
                  </Text>
                  <Text size="sm" c="dimmed">
                    Your session expired. Reconnect to continue importing files.
                  </Text>
                </Stack>
                <Button
                  className="import-file-dialog__connect-button import-file-dialog__connect-button--reconnect"
                  loading={googleConnect.isPending}
                  size="md"
                  variant="default"
                  leftSection={
                    <GoogleDriveLogo className="import-file-dialog__drive-glyph import-file-dialog__drive-glyph--button" />
                  }
                  onClick={() => googleConnect.mutate()}
                >
                  Reconnect Google Drive
                </Button>
              </Stack>
            ) : (
              <Box className="import-file-dialog__connect-card">
                <Stack gap={3}>
                  <Text size="md" fw={700}>
                    Connect Google Drive
                  </Text>
                  <Text size="sm" c="dimmed">
                    Link your Google account to import files in one click.
                  </Text>
                </Stack>
                <Button
                  className="import-file-dialog__connect-button"
                  loading={googleConnect.isPending}
                  size="md"
                  variant="default"
                  leftSection={
                    <GoogleDriveLogo className="import-file-dialog__drive-glyph import-file-dialog__drive-glyph--button" />
                  }
                  onClick={() => googleConnect.mutate()}
                >
                  {t('connectGoogle')}
                </Button>
              </Box>
            )
          ) : (
            <Box className="import-file-dialog__drive-browser">
              <Box className="import-file-dialog__drive-browser-controls">
                <Group justify="space-between" wrap="nowrap" className="import-file-dialog__drive-browser-toolbar">
                  <TextInput
                    ref={searchInputRef}
                    data-autofocus
                    className="import-file-dialog__drive-browser-search"
                    placeholder="Search in Google Drive"
                    leftSection={<IconSearch size={16} />}
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                  />

                  <Group gap={6} wrap="nowrap" className="import-file-dialog__drive-browser-tabs">
                    <Button
                      size="xs"
                      variant="default"
                      className={[
                        'import-file-dialog__drive-browser-tab',
                        driveTab === 'recent' ? 'import-file-dialog__drive-browser-tab--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleDriveTabChange('recent')}
                    >
                      Recent
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      className={[
                        'import-file-dialog__drive-browser-tab',
                        driveTab === 'my_drive' ? 'import-file-dialog__drive-browser-tab--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleDriveTabChange('my_drive')}
                    >
                      My Drive
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      className={[
                        'import-file-dialog__drive-browser-tab',
                        driveTab === 'shared' ? 'import-file-dialog__drive-browser-tab--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleDriveTabChange('shared')}
                    >
                      Shared
                    </Button>
                  </Group>

                  <Group gap={6} wrap="nowrap" className="import-file-dialog__drive-browser-sort-wrap">
                    <Text size="xs" c="dimmed" className="import-file-dialog__drive-browser-sort-label">
                      Sort
                    </Text>
                    <Group gap={6} wrap="nowrap" className="import-file-dialog__drive-browser-sort">
                      <Button
                        size="xs"
                        variant="default"
                        className={[
                          'import-file-dialog__drive-browser-sort-button',
                          driveSort === 'modified_desc' ? 'import-file-dialog__drive-browser-sort-button--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setDriveSort('modified_desc')}
                      >
                        Latest
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        className={[
                          'import-file-dialog__drive-browser-sort-button',
                          driveSort === 'name_asc' ? 'import-file-dialog__drive-browser-sort-button--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setDriveSort('name_asc')}
                      >
                        A-Z
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        className={[
                          'import-file-dialog__drive-browser-sort-button',
                          driveSort === 'size_desc' ? 'import-file-dialog__drive-browser-sort-button--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setDriveSort('size_desc')}
                      >
                        Size
                      </Button>
                    </Group>
                  </Group>
                </Group>
              </Box>

              <Box className="import-file-dialog__drive-browser-content">
                {googleFilesQuery.isPending ? (
                  <Box className="import-file-dialog__state-card">
                    <Group gap={8}>
                      <Loader size="sm" />
                      <Text size="sm">Loading Google Drive files...</Text>
                    </Group>
                  </Box>
                ) : null}

                {googleFilesQuery.error ? (
                  <Alert color="red">{toApiError(googleFilesQuery.error).message}</Alert>
                ) : null}

                <ScrollArea className="import-file-dialog__drive-browser-scroll">
                  <Box className="import-file-dialog__drive-grid-head">
                    <span />
                    <Text size="xs" fw={600} c="dimmed">
                      Name
                    </Text>
                    <Text size="xs" fw={600} c="dimmed">
                      Type
                    </Text>
                    <Text size="xs" fw={600} c="dimmed">
                      Size
                    </Text>
                    <Text size="xs" fw={600} c="dimmed">
                      Updated
                    </Text>
                    <span />
                  </Box>

                  <Stack gap={0} className="import-file-dialog__drive-browser-list">
                    {visibleGoogleFiles.map((file) => {
                      const fileTypePresentation = getFileTypePresentation(file.name, file.mime_type)
                      const isSelected = effectiveSelectedGoogleIdSet.has(file.id)
                      const ownerLabel = file.owner_name || file.owner_email
                      const isTooLarge = (file.size_bytes ?? 0) > MAX_IMPORT_FILE_SIZE_BYTES
                      const { baseName, extension } = splitFileNameForEllipsis(file.name)
                      const rowClassName = [
                        'import-file-dialog__drive-file-row',
                        isSelected ? 'import-file-dialog__drive-file-row--selected' : '',
                        isTooLarge ? 'import-file-dialog__drive-file-row--too-large' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                      const toggleSelection = () => {
                        if (isTooLarge) {
                          return
                        }
                        toggleGoogleSelection(file.id)
                      }

                      return (
                        <Box
                          key={file.id}
                          className={rowClassName}
                          component="div"
                          role={isTooLarge ? undefined : 'checkbox'}
                          tabIndex={isTooLarge ? -1 : 0}
                          onClick={toggleSelection}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') {
                              return
                            }
                            event.preventDefault()
                            toggleSelection()
                          }}
                          title={file.name}
                          aria-checked={isTooLarge ? undefined : isSelected}
                          aria-disabled={isTooLarge}
                        >
                          <SelectionCheckbox
                            checked={isSelected}
                            disabled={isTooLarge}
                            tabIndex={-1}
                            ariaLabel={`Select ${file.name}`}
                            className="import-file-dialog__drive-file-checkbox"
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => toggleSelection()}
                          />

                          <Box className="import-file-dialog__drive-file-name-cell">
                            <Group wrap="nowrap" gap={10}>
                              <span className="import-file-dialog__drive-file-icon" aria-hidden="true">
                                <FileTypeIcon iconKey={fileTypePresentation.iconKey} size={16} />
                              </span>
                              <div className="import-file-dialog__drive-file-main">
                                <Text size="sm" fw={600} className="import-file-dialog__drive-file-name">
                                  <span className="import-file-dialog__drive-file-name-base" title={file.name}>
                                    {baseName}
                                  </span>
                                  {extension ? (
                                    <span className="import-file-dialog__drive-file-name-ext">
                                      {extension}
                                    </span>
                                  ) : null}
                                </Text>
                                {driveTab === 'shared' || file.shared ? (
                                  <Text size="xs" c="dimmed" className="import-file-dialog__drive-file-owner">
                                    {ownerLabel ? `Shared by ${ownerLabel}` : 'Shared with you'}
                                  </Text>
                                ) : null}
                              </div>
                            </Group>
                          </Box>

                          <Text size="xs" c="dimmed" className="import-file-dialog__drive-file-type-cell" truncate="end">
                            {fileTypePresentation.label}
                          </Text>
                          <Text size="sm" c="dimmed" className="import-file-dialog__drive-file-size-cell">
                            {formatFileSize(file.size_bytes)}
                          </Text>
                          <Text size="sm" c="dimmed" className="import-file-dialog__drive-file-updated-cell">
                            {formatDateCompact(file.modified_at)}
                          </Text>

                          {isTooLarge ? (
                            <Text size="xs" className="import-file-dialog__drive-file-too-large-pill">
                              Too large
                            </Text>
                          ) : file.shared ? (
                            <Text size="xs" c="dimmed" className="import-file-dialog__drive-file-shared-pill">
                              Shared
                            </Text>
                          ) : (
                            <span />
                          )}
                        </Box>
                      )
                    })}

                    {!googleFilesQuery.isPending &&
                    !googleFilesQuery.error &&
                    visibleGoogleFiles.length === 0 ? (
                      <Box className="import-file-dialog__drive-browser-empty">
                        <Text size="sm" fw={600}>
                          No files found
                        </Text>
                        <Text size="xs" c="dimmed">
                          Try another query or switch tab.
                        </Text>
                      </Box>
                    ) : null}
                  </Stack>
                </ScrollArea>

                <Group justify="space-between" className="import-file-dialog__drive-browser-footer">
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {importableSelectedGoogleIds.length
                        ? `${importableSelectedGoogleIds.length} selected`
                        : 'Select one or more files to import.'}
                    </Text>
                  </Stack>
                  <Group gap={8}>
                    <Button
                      size="xs"
                      variant="default"
                      disabled={!importableSelectedGoogleIds.length || importMutation.isPending}
                      onClick={() => setSelectedGoogleIds([])}
                    >
                      Clear
                    </Button>
                    <Button
                      size="xs"
                      disabled={!importableSelectedGoogleIds.length}
                      loading={importMutation.isPending}
                      onClick={() => void importPickedFiles(importableSelectedGoogleIds)}
                    >
                      Import selected
                    </Button>
                  </Group>
                </Group>
              </Box>
            </Box>
          )}
        </Stack>
      </Stack>
    </Modal>
  )
}
