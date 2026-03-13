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
  Table,
  Text,
  TextInput,
  FileTypeIcon,
} from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
const DRIVE_FILTER_BUTTON_CLASS =
  'h-8 rounded-lg border border-transparent bg-transparent px-2.5 text-[var(--text-secondary)] font-semibold transition-colors hover:border-[var(--border-muted)] hover:bg-[var(--bg-hover-soft)] hover:text-[var(--text-secondary)] disabled:opacity-60'
const DRIVE_FILTER_BUTTON_ACTIVE_CLASS =
  '!border-[var(--border-muted)] !bg-[var(--bg-subtle)] !text-[var(--text-primary)]'
const MODAL_CONTENT_CLASS =
  '!flex !h-[min(860px,calc(100dvh-32px))] !max-h-[calc(100dvh-32px)] !flex-col !overflow-hidden'
const MODAL_CONTENT_COMPACT_CLASS = '!h-auto'
const MODAL_BODY_CLASS = '!flex !min-h-0 !flex-1 !flex-col !overflow-hidden'
const MODAL_BODY_COMPACT_CLASS = '!overflow-visible !p-4 !pt-[18px]'
const MODAL_HEADER_CLASS = '!relative !min-h-0 !items-center !px-4 !py-[10px] [&::after]:!hidden'
const MODAL_CLOSE_CLASS =
  '!mt-0 !self-center focus:!outline-none focus:!shadow-none focus-visible:!outline-none focus-visible:!shadow-none'
const CONNECT_BUTTON_CLASS =
  'h-[42px] rounded-lg border border-[var(--border-soft)] bg-[var(--bg-surface)] px-4 font-semibold text-[var(--text-primary)] hover:border-[var(--border-soft)] hover:bg-[var(--bg-subtle)]'
const RECONNECT_BUTTON_CLASS =
  'h-[42px] rounded-lg border border-[#63abff] bg-[#63abff] px-4 font-semibold text-white hover:border-[#79b8ff] hover:bg-[#79b8ff]'
const DRIVE_RESULTS_SCROLLBAR_SIZE = 10

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
  const footerSelectionLabel = googleSelectionExceedsBatchLimit
    ? batchTooLargeMessage
    : importableSelectedGoogleIds.length
      ? `${importableSelectedGoogleIds.length} selected`
      : 'Select one or more files to import.'

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
        <Box className="flex w-full min-w-0 items-center gap-4 max-[860px]:items-start">
          <Group wrap="nowrap" gap="sm" className="shrink-0 items-center max-[860px]:items-start">
            <Text className="text-[0.95rem] leading-[1.2] text-[var(--text-primary)]" fw={700}>
              Import from Google Drive
            </Text>
          </Group>

          {showHeaderStatusRow ? (
            <Group
              gap={6}
              wrap="nowrap"
              className={cx(
                'inline-flex w-auto min-w-0 max-w-[min(42vw,420px)] items-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-[10px] py-1 pl-2 [--status-chip-separator-color:var(--separator-soft)] max-[860px]:max-w-[min(54vw,240px)]',
                headerStatusTone === 'disconnected' && '[--status-chip-separator-color:var(--border-soft)]',
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
                      'relative ml-0.5 pl-[9px] before:absolute before:left-0 before:top-1/2 before:h-[14px] before:w-px before:-translate-y-1/2 before:bg-[var(--status-chip-separator-color)] before:content-[\'\']',
                  )}
                >
                  {connectedGoogleEmail}
                </Text>
              ) : null}
              {isGoogleConnected && !tokenExpired ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 border-0 bg-transparent p-0 transition-colors hover:text-[var(--text-primary)] disabled:cursor-default disabled:opacity-55"
                  disabled={googleDisconnect.isPending || googleConnect.isPending}
                  onClick={handleDisconnect}
                >
                  {googleDisconnect.isPending ? (
                    'Disconnecting...'
                  ) : (
                    <>
                      <IconLogout2 size={12} stroke={1.9} aria-hidden="true" />
                      <span className='text-[13px] text-red-300'>{t('disconnectGoogle')}</span>
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
          MODAL_CONTENT_CLASS,
          !canImport && MODAL_CONTENT_COMPACT_CLASS,
        ),
        body: cx(
          MODAL_BODY_CLASS,
          !canImport && MODAL_BODY_COMPACT_CLASS,
        ),
        header: MODAL_HEADER_CLASS,
        close: MODAL_CLOSE_CLASS,
      }}
    >
      <Box className={cx('flex min-h-0 flex-1 flex-col gap-3 overflow-hidden', !canImport && 'overflow-visible')}>
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
            <Stack className="mt-2 px-0.5 pb-0.5 pt-1" gap="md">
              <Stack gap={5}>
                <Text size="md" fw={700}>
                  Reconnect Google Drive
                </Text>
                <Text size="sm" c="dimmed">
                  Your session expired. Reconnect to continue importing files.
                </Text>
              </Stack>
              <Button
                className={RECONNECT_BUTTON_CLASS}
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
            <Box className="mt-2 grid gap-[14px] rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-surface)] p-4">
              <Stack gap={3}>
                <Text size="md" fw={700}>
                  Connect Google Drive
                </Text>
                <Text size="sm" c="dimmed">
                  Link your Google account to import files in one click.
                </Text>
              </Stack>
              <Button
                className={CONNECT_BUTTON_CLASS}
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
          <Box className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden pt-1">
            <Box className="border-b border-[var(--separator-muted)] px-0 py-0 pb-2.5 pt-1.5">
              <Group
                justify="space-between"
                wrap="nowrap"
                className="items-stretch gap-2 max-[860px]:flex-col max-[860px]:items-stretch"
              >
                <TextInput
                  ref={searchInputRef}
                  data-autofocus
                  className="flex-1"
                  classNames={{
                    input:
                      'min-h-9 rounded-lg border-[var(--border-muted)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-[border-color,box-shadow,background-color] hover:border-[var(--border-muted)] focus:border-[var(--border-muted)] focus:shadow-[0_0_0_1px_rgb(148_163_184_/_22%)] focus-visible:border-[var(--border-muted)] focus-visible:shadow-[0_0_0_1px_rgb(148_163_184_/_22%)]',
                  }}
                  placeholder="Search in Google Drive"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                />

                <Group gap={6} wrap="nowrap" className="shrink-0 max-[860px]:justify-start">
                  <Button
                    size="xs"
                    variant="default"
                    className={cx(
                      DRIVE_FILTER_BUTTON_CLASS,
                      driveTab === 'recent' && DRIVE_FILTER_BUTTON_ACTIVE_CLASS,
                    )}
                    onClick={() => handleDriveTabChange('recent')}
                  >
                    Recent
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    className={cx(
                      DRIVE_FILTER_BUTTON_CLASS,
                      driveTab === 'my_drive' && DRIVE_FILTER_BUTTON_ACTIVE_CLASS,
                    )}
                    onClick={() => handleDriveTabChange('my_drive')}
                  >
                    My Drive
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    className={cx(
                      DRIVE_FILTER_BUTTON_CLASS,
                      driveTab === 'shared' && DRIVE_FILTER_BUTTON_ACTIVE_CLASS,
                    )}
                    onClick={() => handleDriveTabChange('shared')}
                  >
                    Shared
                  </Button>
                </Group>

                <Group
                  gap={6}
                  wrap="nowrap"
                  className="shrink-0 border-l border-[var(--separator-muted)] pl-2.5 max-[860px]:justify-start max-[860px]:border-l-0 max-[860px]:pl-0"
                >
                  <Text size="xs" c="dimmed" className="tracking-[0.01em] text-[var(--text-muted)]">
                    Sort
                  </Text>
                  <Group gap={6} wrap="nowrap" className="shrink-0 max-[860px]:justify-start">
                    <Button
                      size="xs"
                      variant="default"
                      className={cx(
                        DRIVE_FILTER_BUTTON_CLASS,
                        driveSort === 'modified_desc' && DRIVE_FILTER_BUTTON_ACTIVE_CLASS,
                      )}
                      onClick={() => setDriveSort('modified_desc')}
                    >
                      Latest
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      className={cx(
                        DRIVE_FILTER_BUTTON_CLASS,
                        driveSort === 'name_asc' && DRIVE_FILTER_BUTTON_ACTIVE_CLASS,
                      )}
                      onClick={() => setDriveSort('name_asc')}
                    >
                      A-Z
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      className={cx(
                        DRIVE_FILTER_BUTTON_CLASS,
                        driveSort === 'size_desc' && DRIVE_FILTER_BUTTON_ACTIVE_CLASS,
                      )}
                      onClick={() => setDriveSort('size_desc')}
                    >
                      Size
                    </Button>
                  </Group>
                </Group>
              </Group>
            </Box>

            <Box className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
              <Stack gap="xs" className="shrink-0">
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
              </Stack>

              <ScrollArea
                h="100%"
                type="always"
                scrollbarSize={DRIVE_RESULTS_SCROLLBAR_SIZE}
                className="min-h-0 rounded-[10px] border border-[var(--separator-muted)] bg-[var(--bg-surface)]"
              >
                {!googleFilesQuery.isPending && !googleFilesQuery.error && visibleGoogleFiles.length === 0 ? (
                  <Box className="flex min-h-full items-center justify-center p-3">
                    <Box className="w-full rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--bg-surface)] px-3 py-4 text-center">
                      <Text size="sm" fw={600}>
                        No files found
                      </Text>
                      <Text size="xs" c="dimmed">
                        Try another query or switch tab.
                      </Text>
                    </Box>
                  </Box>
                ) : null}

                {visibleGoogleFiles.length > 0 ? (
                  <Table horizontalSpacing="md" verticalSpacing="sm" className="min-w-[720px] table-fixed max-[860px]:min-w-[640px]">
                    <colgroup>
                      <col className="w-8 max-[860px]:w-7" />
                      <col />
                      <col className="w-[118px] max-[860px]:w-[100px]" />
                      <col className="w-[94px] max-[860px]:w-[84px]" />
                      <col className="w-[128px] max-[860px]:w-[112px]" />
                      <col className="w-[106px] max-[860px]:w-[104px]" />
                    </colgroup>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th className="sticky top-0 z-[1] border-b border-[var(--separator-soft)] bg-[var(--bg-subtle)] py-2.5" />
                        <Table.Th className="sticky top-0 z-[1] border-b border-[var(--separator-soft)] bg-[var(--bg-subtle)] py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                          Name
                        </Table.Th>
                        <Table.Th className="sticky top-0 z-[1] border-b border-[var(--separator-soft)] bg-[var(--bg-subtle)] py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                          Type
                        </Table.Th>
                        <Table.Th className="sticky top-0 z-[1] border-b border-[var(--separator-soft)] bg-[var(--bg-subtle)] py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                          Size
                        </Table.Th>
                        <Table.Th className="sticky top-0 z-[1] border-b border-[var(--separator-soft)] bg-[var(--bg-subtle)] py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                          Updated
                        </Table.Th>
                        <Table.Th className="sticky top-0 z-[1] border-b border-[var(--separator-soft)] bg-[var(--bg-subtle)] py-2.5" />
                      </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                      {visibleGoogleFiles.map((file) => {
                        const fileTypePresentation = getFileTypePresentation(file.name, file.mime_type)
                        const isSelected = effectiveSelectedGoogleIdSet.has(file.id)
                        const ownerLabel = file.owner_name || file.owner_email
                        const isTooLarge = (file.size_bytes ?? 0) > MAX_IMPORT_FILE_SIZE_BYTES
                        const { baseName, extension } = splitFileNameForEllipsis(file.name)

                        const toggleSelection = () => {
                          if (isTooLarge) {
                            return
                          }
                          toggleGoogleSelection(file.id)
                        }

                        return (
                          <Table.Tr
                            key={file.id}
                            className="cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-hover-soft)] data-[selected]:bg-[var(--bg-subtle)] data-[too-large]:cursor-not-allowed data-[too-large]:bg-[var(--state-danger-bg-soft)] data-[too-large]:hover:bg-[var(--state-danger-bg-soft)]"
                            data-selected={isSelected || undefined}
                            data-too-large={isTooLarge || undefined}
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
                            <Table.Td className="border-b border-[var(--separator-soft)] py-2.5 pl-0 pr-0 align-middle">
                              <span className="flex min-h-full items-center justify-start pl-1">
                                <SelectionCheckbox
                                  checked={isSelected}
                                  disabled={isTooLarge}
                                  tabIndex={-1}
                                  ariaLabel={`Select ${file.name}`}
                                  onClick={(event) => event.stopPropagation()}
                                  onCheckedChange={() => toggleSelection()}
                                />
                              </span>
                            </Table.Td>

                            <Table.Td className="min-w-0 border-b border-[var(--separator-soft)] py-2.5 align-middle">
                              <Group wrap="nowrap" gap={10} className="min-w-0">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                                  <FileTypeIcon iconKey={fileTypePresentation.iconKey} size={16} />
                                </span>
                                <div className="grid min-w-0 gap-0.5">
                                  <Text size="sm" fw={600} className="flex w-full min-w-0 items-baseline">
                                    <span className="block min-w-0 flex-1 truncate" title={file.name}>
                                      {baseName}
                                    </span>
                                    {extension ? <span className="shrink-0 whitespace-nowrap">{extension}</span> : null}
                                  </Text>
                                  {driveTab === 'shared' || file.shared ? (
                                    <Text size="xs" c="dimmed" className="block min-w-0 truncate">
                                      {ownerLabel ? `Shared by ${ownerLabel}` : 'Shared with you'}
                                    </Text>
                                  ) : null}
                                </div>
                              </Group>
                            </Table.Td>

                            <Table.Td className="border-b border-[var(--separator-soft)] py-2.5 align-middle">
                              <Text size="xs" c="dimmed" className="block min-w-0 truncate">
                                {fileTypePresentation.label}
                              </Text>
                            </Table.Td>

                            <Table.Td className="border-b border-[var(--separator-soft)] py-2.5 align-middle">
                              <Text size="sm" c="dimmed" className="block min-w-0 truncate">
                                {formatFileSize(file.size_bytes)}
                              </Text>
                            </Table.Td>

                            <Table.Td className="border-b border-[var(--separator-soft)] py-2.5 align-middle">
                              <Text size="sm" c="dimmed" className="block min-w-0 truncate">
                                {formatDateCompact(file.modified_at)}
                              </Text>
                            </Table.Td>

                            <Table.Td className="border-b border-[var(--separator-soft)] py-2.5 text-right align-middle">
                              {isTooLarge ? (
                                <span className="inline-flex min-h-5 min-w-[84px] items-center justify-center whitespace-nowrap rounded-full border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] px-3.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--state-danger-text)]">
                                  Too large
                                </span>
                              ) : file.shared ? (
                                <span className="inline-flex min-h-5 min-w-[72px] items-center justify-center whitespace-nowrap rounded-full border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3.5 py-0.5 text-[11px] font-semibold leading-none text-[var(--text-secondary)]">
                                  Shared
                                </span>
                              ) : (
                                <span aria-hidden="true" />
                              )}
                            </Table.Td>
                          </Table.Tr>
                        )
                      })}
                    </Table.Tbody>
                  </Table>
                ) : null}
              </ScrollArea>
            </Box>

            <Group justify="space-between" className="border-t border-[var(--separator-muted)] pt-3">
              <Text
                size="xs"
                className={cx(
                  'min-w-0',
                  googleSelectionExceedsBatchLimit ? 'text-[var(--state-danger-text)]' : 'text-[var(--text-muted)]',
                )}
              >
                {footerSelectionLabel}
              </Text>

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
        )}
      </Box>
    </Modal>
  )
}
