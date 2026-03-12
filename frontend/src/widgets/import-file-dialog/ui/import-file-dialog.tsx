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
import {
  MAX_IMPORT_BATCH_SIZE_BYTES,
  MAX_IMPORT_FILE_SIZE_BYTES,
  getImportBatchTooLargeMessage,
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
  SelectionCheckbox,
  Stack,
  Text,
  TextInput,
  FileTypeIcon,
} from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

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
  const selectedImportableGoogleTotalSizeBytes = useMemo(
    () =>
      importableSelectedGoogleIds.reduce((total, id) => {
        const file = visibleGoogleFilesById.get(id)
        return total + Math.max(0, Number(file?.size_bytes ?? 0) || 0)
      }, 0),
    [importableSelectedGoogleIds, visibleGoogleFilesById],
  )
  const googleSelectionExceedsBatchLimit = selectedImportableGoogleTotalSizeBytes > MAX_IMPORT_BATCH_SIZE_BYTES
  const batchTooLargeMessage = getImportBatchTooLargeMessage()

  const importPickedFiles = async (googleFileIds: string[]) => {
    if (!googleFileIds.length) {
      return
    }

    if (googleSelectionExceedsBatchLimit) {
      notifyError(batchTooLargeMessage)
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
        <Box className="flex w-full min-w-0 items-center gap-4 pr-0">
          <Group wrap="nowrap" gap="sm" className="flex-none items-center max-[860px]:flex-col max-[860px]:items-start max-[860px]:gap-0.5">
            <Text className="text-[0.95rem] leading-[1.2] text-[var(--text-primary)]" fw={700}>
              Import from Google Drive
            </Text>
          </Group>

          {showHeaderStatusRow ? (
            <Group
              gap={6}
              wrap="nowrap"
              className={cx(
                'inline-flex w-auto min-w-0 max-w-[min(42vw,420px)] items-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-[10px] py-1 pl-2',
                headerStatusTone === 'disconnected'
                  ? '[--status-chip-separator-color:var(--border-soft)]'
                  : '[--status-chip-separator-color:var(--separator-soft)]',
              )}
            >
              <GoogleDriveLogo className="h-3 w-[14px] shrink-0 object-contain" />
              {showHeaderStatusLabel ? (
                <Text size="xs" fw={600} className="leading-[1.35] text-[var(--text-secondary)]">
                  {headerStatusLabel}
                </Text>
              ) : null}
              {connectedGoogleEmail ? (
                <Text
                  size="xs"
                  truncate="end"
                  className={cx(
                    'max-w-[min(42vw,320px)] leading-[1.35] text-[var(--text-secondary)] max-[860px]:max-w-[min(54vw,240px)]',
                    showHeaderStatusLabel &&
                      'relative ml-[2px] pl-[9px] before:absolute before:left-0 before:top-1/2 before:h-[14px] before:w-px before:-translate-y-1/2 before:bg-[var(--status-chip-separator-color)]',
                  )}
                >
                  {connectedGoogleEmail}
                </Text>
              ) : null}
              {isGoogleConnected && !tokenExpired ? (
                <button
                  type="button"
                  className="ml-1 inline-flex min-h-[18px] items-center gap-1 border-0 bg-transparent px-0 py-px text-xs font-semibold leading-[1.35] text-[var(--text-secondary)] transition-colors duration-[120ms] ease-[ease] hover:text-[var(--text-primary)] disabled:cursor-default disabled:opacity-[0.55]"
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
        content: cx(
          'flex flex-col',
          canImport
            ? 'h-[min(860px,calc(100dvh-32px))]'
            : 'h-auto max-h-[calc(100dvh-32px)]',
        ),
        body: cx(
          'flex min-h-0 flex-col overflow-hidden',
          canImport ? 'h-full' : 'h-auto px-4 pb-4 pt-[18px]',
        ),
        header: 'relative min-h-0 items-center px-4 py-2.5 [&::after]:hidden',
        close:
          'mt-0 self-center focus:!outline-none focus-visible:!outline-none focus:!shadow-none focus-visible:!shadow-none',
      }}
    >
      <Stack className="flex min-h-0 flex-1 flex-col" gap="md">
        <Stack
          gap="sm"
          className={cx(
            'flex min-h-0 flex-1 flex-col overflow-hidden',
            !canImport && 'flex-none overflow-visible',
          )}
        >
          {googleStatusQuery.isPending ? (
            <Box className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2.5">
              <Group gap={8}>
                <Loader size="sm" />
                <Text size="sm">Checking Google Drive connection...</Text>
              </Group>
            </Box>
          ) : null}

          {!canImport ? (
            tokenExpired ? (
              <Stack className="mt-2.5 px-0.5 pb-0.5 pt-1" gap="md">
                <Stack gap={5}>
                  <Text size="md" fw={700}>
                    Reconnect Google Drive
                  </Text>
                  <Text size="sm" c="dimmed">
                    Your session expired. Reconnect to continue importing files.
                  </Text>
                </Stack>
                <Button
                  className="min-h-[42px] border border-[#63abff] bg-[#63abff] font-semibold text-white transition-colors duration-[120ms] ease-[ease] hover:enabled:!border-[#79b8ff] hover:enabled:!bg-[#79b8ff] hover:enabled:!text-white"
                  loading={googleConnect.isPending}
                  size="md"
                  variant="default"
                  leftSection={
                    <GoogleDriveLogo className="h-[14px] w-4 shrink-0 object-contain" />
                  }
                  onClick={() => googleConnect.mutate()}
                >
                  Reconnect Google Drive
                </Button>
              </Stack>
            ) : (
              <Box className="mt-2 grid gap-3.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
                <Stack gap={3}>
                  <Text size="md" fw={700}>
                    Connect Google Drive
                  </Text>
                  <Text size="sm" c="dimmed">
                    Link your Google account to import files in one click.
                  </Text>
                </Stack>
                <Button
                  className="min-h-[42px] border border-[var(--border-soft)] bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)] transition-colors duration-[120ms] ease-[ease] hover:enabled:!bg-[var(--bg-subtle)]"
                  loading={googleConnect.isPending}
                  size="md"
                  variant="default"
                  leftSection={
                    <GoogleDriveLogo className="h-[14px] w-4 shrink-0 object-contain" />
                  }
                  onClick={() => googleConnect.mutate()}
                >
                  {t('connectGoogle')}
                </Button>
              </Box>
            )
          ) : (
            <Box className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-transparent pt-1">
              <Box className="rounded-none border-0 border-b border-[var(--separator-muted)] bg-transparent px-0 pb-2.5 pt-1.5">
                <Group
                  justify="space-between"
                  wrap="nowrap"
                  className="items-stretch gap-2 max-[860px]:flex-col max-[860px]:items-stretch"
                >
                  <TextInput
                    ref={searchInputRef}
                    data-autofocus
                    className="flex-1"
                    styles={{
                      input: {
                        borderColor: 'var(--border-muted)',
                        minHeight: 36,
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                      },
                    }}
                    placeholder="Search in Google Drive"
                    leftSection={<IconSearch size={16} />}
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                  />

                  <Group gap={6} wrap="nowrap" className="flex-none max-[860px]:justify-start">
                    <Button
                      size="xs"
                      variant="default"
                      className={cx(
                        'min-h-8 rounded-lg border border-transparent bg-transparent px-2.5 font-semibold text-[var(--text-secondary)] transition-[background-color,border-color,color] duration-[150ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)] hover:enabled:!text-[var(--text-secondary)]',
                        driveTab === 'recent' && '!border-[var(--border-muted)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)]',
                      )}
                      onClick={() => handleDriveTabChange('recent')}
                    >
                      Recent
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      className={cx(
                        'min-h-8 rounded-lg border border-transparent bg-transparent px-2.5 font-semibold text-[var(--text-secondary)] transition-[background-color,border-color,color] duration-[150ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)] hover:enabled:!text-[var(--text-secondary)]',
                        driveTab === 'my_drive' && '!border-[var(--border-muted)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)]',
                      )}
                      onClick={() => handleDriveTabChange('my_drive')}
                    >
                      My Drive
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      className={cx(
                        'min-h-8 rounded-lg border border-transparent bg-transparent px-2.5 font-semibold text-[var(--text-secondary)] transition-[background-color,border-color,color] duration-[150ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)] hover:enabled:!text-[var(--text-secondary)]',
                        driveTab === 'shared' && '!border-[var(--border-muted)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)]',
                      )}
                      onClick={() => handleDriveTabChange('shared')}
                    >
                      Shared
                    </Button>
                  </Group>

                  <Group
                    gap={6}
                    wrap="nowrap"
                    className="flex-none border-l border-[var(--separator-muted)] pl-2.5 max-[860px]:justify-start"
                  >
                    <Text size="xs" c="dimmed" className="tracking-[0.01em] text-[var(--text-muted)]">
                      Sort
                    </Text>
                    <Group gap={6} wrap="nowrap" className="flex-none max-[860px]:justify-start">
                      <Button
                        size="xs"
                        variant="default"
                        className={cx(
                          'min-h-8 rounded-lg border border-transparent bg-transparent px-2.5 font-semibold text-[var(--text-secondary)] transition-[background-color,border-color,color] duration-[150ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)] hover:enabled:!text-[var(--text-secondary)]',
                          driveSort === 'modified_desc' && '!border-[var(--border-muted)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)]',
                        )}
                        onClick={() => setDriveSort('modified_desc')}
                      >
                        Latest
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        className={cx(
                          'min-h-8 rounded-lg border border-transparent bg-transparent px-2.5 font-semibold text-[var(--text-secondary)] transition-[background-color,border-color,color] duration-[150ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)] hover:enabled:!text-[var(--text-secondary)]',
                          driveSort === 'name_asc' && '!border-[var(--border-muted)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)]',
                        )}
                        onClick={() => setDriveSort('name_asc')}
                      >
                        A-Z
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        className={cx(
                          'min-h-8 rounded-lg border border-transparent bg-transparent px-2.5 font-semibold text-[var(--text-secondary)] transition-[background-color,border-color,color] duration-[150ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)] hover:enabled:!text-[var(--text-secondary)]',
                          driveSort === 'size_desc' && '!border-[var(--border-muted)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)]',
                        )}
                        onClick={() => setDriveSort('size_desc')}
                      >
                        Size
                      </Button>
                    </Group>
                  </Group>
                </Group>
              </Box>

              <Box className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-none border-0 bg-transparent p-0">
                {googleFilesQuery.isPending ? (
                  <Box className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2.5">
                    <Group gap={8}>
                      <Loader size="sm" />
                      <Text size="sm">Loading Google Drive files...</Text>
                    </Group>
                  </Box>
                ) : null}

                {googleFilesQuery.error ? (
                  <Alert color="red">{toApiError(googleFilesQuery.error).message}</Alert>
                ) : null}

                <ScrollArea className="[--drive-grid-columns:32px_minmax(0,1.9fr)_minmax(118px,1fr)_94px_128px_88px] min-h-0 flex-1 rounded-[10px] border border-[var(--separator-muted)] bg-[var(--bg-surface)] p-0 max-[860px]:[--drive-grid-columns:28px_minmax(0,1.7fr)_minmax(100px,1fr)_84px_112px_76px]">
                  <Box className="sticky top-0 z-[1] grid grid-cols-[var(--drive-grid-columns)] items-center gap-x-2.5 border-b border-[var(--separator-soft)] bg-[var(--bg-subtle)] px-3 py-2.5 max-[860px]:gap-x-2">
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

                  <Stack gap={0} className="min-h-0">
                    {visibleGoogleFiles.map((file) => {
                      const fileTypePresentation = getFileTypePresentation(file.name, file.mime_type)
                      const isSelected = effectiveSelectedGoogleIdSet.has(file.id)
                      const ownerLabel = file.owner_name || file.owner_email
                      const isTooLarge = (file.size_bytes ?? 0) > MAX_IMPORT_FILE_SIZE_BYTES
                      const { baseName, extension } = splitFileNameForEllipsis(file.name)
                      const rowClassName = [
                        'grid w-full cursor-pointer grid-cols-[var(--drive-grid-columns)] items-center gap-x-2.5 border-0 border-b border-[var(--separator-soft)] bg-transparent px-3 py-2.5 text-left shadow-none transition-[border-color,background-color] duration-[160ms] ease-[ease] hover:border-b-[var(--border-muted)] hover:bg-[var(--bg-hover-soft)] max-[860px]:gap-x-2',
                        isSelected ? 'bg-[var(--bg-subtle)]' : '',
                        isTooLarge
                          ? 'cursor-not-allowed bg-[var(--state-danger-bg-soft)] hover:border-b-[var(--state-danger-border)] hover:bg-[var(--state-danger-bg-soft)]'
                          : '',
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
                            className="ml-0.5 inline-flex items-center justify-center"
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => toggleSelection()}
                          />

                          <Box className="min-w-0">
                            <Group wrap="nowrap" gap={10}>
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-none border-0 bg-transparent" aria-hidden="true">
                                <FileTypeIcon iconKey={fileTypePresentation.iconKey} size={16} />
                              </span>
                              <div className="grid min-w-0 gap-0.5">
                                <Text size="sm" fw={600} className="flex w-full min-w-0 items-baseline gap-0">
                                  <span className="min-w-0 flex-1 truncate whitespace-nowrap" title={file.name}>
                                    {baseName}
                                  </span>
                                  {extension ? (
                                    <span className="shrink-0 whitespace-nowrap">
                                      {extension}
                                    </span>
                                  ) : null}
                                </Text>
                                {driveTab === 'shared' || file.shared ? (
                                  <Text size="xs" c="dimmed" className="truncate whitespace-nowrap">
                                    {ownerLabel ? `Shared by ${ownerLabel}` : 'Shared with you'}
                                  </Text>
                                ) : null}
                              </div>
                            </Group>
                          </Box>

                          <Text size="xs" c="dimmed" className="block min-w-0 truncate whitespace-nowrap" truncate="end">
                            {fileTypePresentation.label}
                          </Text>
                          <Text size="sm" c="dimmed" className="block min-w-0 truncate whitespace-nowrap">
                            {formatFileSize(file.size_bytes)}
                          </Text>
                          <Text size="sm" c="dimmed" className="block min-w-0 truncate whitespace-nowrap">
                            {formatDateCompact(file.modified_at)}
                          </Text>

                          {isTooLarge ? (
                            <Text size="xs" className="justify-self-end whitespace-nowrap rounded-full border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-2.5 py-[3px] font-bold text-[var(--state-danger-text)]">
                              Too large
                            </Text>
                          ) : file.shared ? (
                            <Text size="xs" c="dimmed" className="justify-self-end whitespace-nowrap rounded-full border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-2.5 py-[3px] font-semibold text-[var(--text-secondary)]">
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
                      <Box className="rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-4 text-center">
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

                <Group justify="space-between" className="mt-auto border-t border-[var(--separator-muted)] bg-transparent pt-3">
                  <Stack gap={2}>
                    {googleSelectionExceedsBatchLimit ? (
                      <Text size="xs" c="red">
                        {batchTooLargeMessage}
                      </Text>
                    ) : (
                      <Text size="xs" c="dimmed">
                        {importableSelectedGoogleIds.length
                          ? `${importableSelectedGoogleIds.length} selected`
                          : 'Select one or more files to import.'}
                      </Text>
                    )}
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
                      disabled={!importableSelectedGoogleIds.length || googleSelectionExceedsBatchLimit}
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
