import { useMemo } from 'react'
import { IconDownload, IconExternalLink, IconX } from '@tabler/icons-react'

import type { ContentItem } from '@/entities/content-item'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { formatDate } from '@/shared/lib/date/format-date'
import { downloadBlob } from '@/shared/lib/file/download-blob'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { isInlinePreviewableMime } from '@/shared/lib/file/is-previewable-file'
import { useObjectUrl } from '@/shared/lib/file/use-object-url'
import type { PreviewPaneLayoutState } from '@/shared/lib/preview/use-preview-pane-layout'
import { ActionIcon, Alert, Box, Button, Group, Loader, Stack, Text } from '@/shared/ui'

type PreviewPaneContent = {
  blob: Blob
}

type PreviewPaneViewProps = {
  layout: PreviewPaneLayoutState
  currentItem: ContentItem | undefined
  itemPending: boolean
  itemError: unknown
  currentContent: PreviewPaneContent | undefined
  contentPending: boolean
  contentError: unknown
  onClose: () => void
}

const PREVIEW_ACTION_BUTTON_STYLES = {
  root: {
    border: '1px solid var(--border-soft)',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    justifyContent: 'center',
    borderRadius: '10px',
    minHeight: '34px',
    height: '34px',
    transition: 'background-color 120ms ease, border-color 120ms ease',
    '&:hover:not(:disabled)': {
      borderColor: 'var(--border-muted)',
      background: 'var(--bg-hover-soft)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--accent)',
      outlineOffset: '1px',
    },
    '&:disabled': {
      opacity: 0.52,
    },
  },
  inner: {
    justifyContent: 'center',
    minHeight: '34px',
  },
  section: {
    marginInlineEnd: '6px',
    color: 'var(--accent)',
  },
  label: {
    textAlign: 'center',
    fontWeight: 600,
  },
} as const

const formatStatus = (status: string): string => {
  if (!status) {
    return '-'
  }

  return status.charAt(0).toUpperCase() + status.slice(1)
}

const getSourceLabel = (origin: 'google_drive' | 'local_upload' | 'copied' | null): string => {
  if (origin === 'google_drive') {
    return t('previewSourceGoogleDrive')
  }
  if (origin === 'local_upload') {
    return t('previewSourceLocalUpload')
  }
  if (origin === 'copied') {
    return t('previewSourceCopied')
  }

  return '-'
}

export const PreviewPaneView = ({
  layout,
  currentItem,
  itemPending,
  itemError,
  currentContent,
  contentPending,
  contentError,
  onClose,
}: PreviewPaneViewProps) => {
  const currentContentObjectUrl = useObjectUrl(currentContent?.blob)
  const currentFileType = useMemo(() => {
    if (!currentItem) {
      return null
    }

    return getFileTypePresentation(currentItem.name, currentItem.mimeType)
  }, [currentItem])

  const detailsRows = useMemo(() => {
    if (!currentItem) {
      return []
    }

    return [
      {
        label: t('previewFieldType'),
        value: currentFileType?.label ?? '-',
      },
      {
        label: t('previewFieldSize'),
        value: currentItem.kind === 'file' ? formatFileSize(currentItem.sizeBytes) : '-',
      },
      {
        label: t('previewFieldUpdated'),
        value: formatDate(currentItem.updatedAt),
      },
      {
        label: t('previewFieldCreated'),
        value: formatDate(currentItem.createdAt),
      },
      {
        label: t('previewFieldImported'),
        value: currentItem.importedAt ? formatDate(currentItem.importedAt) : '-',
      },
      {
        label: t('previewFieldStatus'),
        value: formatStatus(currentItem.status),
      },
      {
        label: t('previewFieldSource'),
        value: getSourceLabel(currentItem.origin),
      },
    ]
  }, [currentFileType?.label, currentItem])

  const canDownloadFile = Boolean(
    currentItem && currentItem.kind === 'file' && currentContent,
  )
  const canOpenInBrowser = Boolean(
    currentItem &&
      currentItem.kind === 'file' &&
      currentContentObjectUrl &&
      isInlinePreviewableMime(currentItem.mimeType),
  )

  const handleOpenInNewTab = () => {
    if (!currentContentObjectUrl) {
      return
    }

    window.open(currentContentObjectUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDownload = () => {
    if (!currentContent || !currentItem || currentItem.kind !== 'file') {
      return
    }

    downloadBlob(currentContent.blob, currentItem.name)
  }

  const previewVisual = useMemo(() => {
    if (!currentItem) {
      return null
    }

    if (currentItem.kind === 'folder') {
      return (
        <Box className="flex min-h-[160px] w-full items-center justify-center px-3 text-center">
          <Text c="dimmed">{t('previewNoVisualForFolder')}</Text>
        </Box>
      )
    }

    const inline = isInlinePreviewableMime(currentItem.mimeType)
    const isImage = currentItem.mimeType?.startsWith('image/')
    const isPdf = currentItem.mimeType === 'application/pdf'

    if (!inline) {
      return (
        <Alert color="yellow" title={t('previewUnsupportedTitle')}>
          {t('previewUnsupported')}
        </Alert>
      )
    }

    if (layout.isOpeningAnimationPending && !contentError) {
      if (isPdf) {
        return (
          <Box className="relative w-full min-h-[320px] overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)]">
            <Box className="absolute inset-0 flex items-center justify-center bg-[var(--bg-subtle)]">
              <Loader />
            </Box>
          </Box>
        )
      }

      return (
        <Box className="flex min-h-[160px] w-full items-center justify-center px-3 text-center">
          <Loader />
        </Box>
      )
    }

    if (contentPending) {
      if (isPdf) {
        return (
          <Box className="relative w-full min-h-[320px] overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)]">
            <Box className="absolute inset-0 flex items-center justify-center bg-[var(--bg-subtle)]">
              <Loader />
            </Box>
          </Box>
        )
      }

      return (
        <Box className="flex min-h-[160px] w-full items-center justify-center px-3 text-center">
          <Loader />
        </Box>
      )
    }

    if (contentError) {
      const apiError = toApiError(contentError)
      const message =
        apiError.code === 'file_content_missing'
          ? t('previewMissing')
          : apiError.code === 'unsupported_item_type'
            ? t('previewUnsupported')
            : apiError.message

      return (
        <Alert color="orange" title={t('previewErrorTitle')}>
          {message}
        </Alert>
      )
    }

    if (!currentContent || !currentContentObjectUrl) {
      return (
        <Box className="flex min-h-[160px] w-full items-center justify-center px-3 text-center">
          <Text c="dimmed">{t('previewEmpty')}</Text>
        </Box>
      )
    }

    if (isImage) {
      return (
        <img
          src={currentContentObjectUrl}
          alt={currentItem.name}
          className="block h-auto max-h-[360px] w-auto max-w-full rounded-lg object-contain"
        />
      )
    }

    if (isPdf) {
      const previewSource = `${currentContentObjectUrl}#zoom=page-width`
      const showPdfFrame = layout.canRenderHeavyPreview && !layout.isResizing

      return (
        <Box className="relative w-full min-h-[320px] overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)]">
          {showPdfFrame ? (
            <iframe
              title={currentItem.name}
              src={previewSource}
              className="absolute inset-0 h-full w-full border-0 bg-[var(--bg-subtle)]"
            />
          ) : null}
          {!showPdfFrame ? (
            <Box className="absolute inset-0 flex items-center justify-center bg-[var(--bg-subtle)]">
              <Loader size="sm" />
            </Box>
          ) : null}
        </Box>
      )
    }

    if (!layout.canRenderHeavyPreview) {
      return (
        <Box className="flex min-h-[160px] w-full items-center justify-center px-3 text-center">
          <Loader size="sm" />
        </Box>
      )
    }

    return (
      <iframe
        title={currentItem.name}
        src={currentContentObjectUrl}
        className="w-full min-h-[320px] rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)]"
      />
    )
  }, [
    contentError,
    contentPending,
    currentContent,
    currentContentObjectUrl,
    currentItem,
    layout.canRenderHeavyPreview,
    layout.isOpeningAnimationPending,
    layout.isResizing,
  ])

  let previewBody = null

  if (layout.displayPreviewItemId) {
    if (itemPending) {
      previewBody = (
        <Box className="flex min-h-full items-center justify-center">
          <Loader />
        </Box>
      )
    } else if (itemError) {
      const apiError = toApiError(itemError)
      previewBody = (
        <Box className="flex min-h-full items-center justify-center p-3">
          <Alert color="red" title={t('previewMetadataErrorTitle')}>
            {apiError.message}
          </Alert>
        </Box>
      )
    } else {
      previewBody = (
        <Box className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3">
          <Stack gap="md">
            <Box className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-2.5">
              {previewVisual}
            </Box>

            <Box>
              <Text size="xs" fw={700} className="normal-case tracking-normal text-[var(--text-secondary)]">
                {t('previewActionsTitle')}
              </Text>
              <Group grow className="m-0 gap-2" mt={8}>
                <Button
                  size="xs"
                  variant="default"
                  className="h-[34px] transition-[border-color,background-color] duration-[120ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)]"
                  styles={PREVIEW_ACTION_BUTTON_STYLES}
                  leftSection={<IconExternalLink size={14} />}
                  onClick={handleOpenInNewTab}
                  disabled={!canOpenInBrowser}
                >
                  {t('previewActionOpen')}
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  className="h-[34px] transition-[border-color,background-color] duration-[120ms] ease-[ease] hover:enabled:!border-[var(--border-muted)] hover:enabled:!bg-[var(--bg-hover-soft)]"
                  styles={PREVIEW_ACTION_BUTTON_STYLES}
                  leftSection={<IconDownload size={14} />}
                  onClick={handleDownload}
                  disabled={!canDownloadFile}
                >
                  {t('previewActionDownload')}
                </Button>
              </Group>
            </Box>

            <Box className="overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--bg-subtle)]">
              {detailsRows.map((row) => (
                <Box key={row.label} className="flex items-baseline justify-between gap-2.5 border-b border-[var(--separator-soft)] px-3 py-2.5 last:border-b-0">
                  <Text size="xs" c="dimmed" className="shrink-0 whitespace-nowrap">
                    {row.label}
                  </Text>
                  <Text size="sm" className="min-w-0 overflow-hidden text-right text-ellipsis whitespace-nowrap" title={row.value}>
                    {row.value}
                  </Text>
                </Box>
              ))}
            </Box>
          </Stack>
        </Box>
      )
    }
  }

  if (!layout.isRendered) {
    return null
  }

  return (
    <Box className={layout.paneClassName} style={layout.panelStyle}>
      {layout.isOpen ? (
        <Box
          className="group absolute inset-y-0 left-0 z-[25] h-full w-3 -translate-x-1/2 cursor-col-resize"
          onPointerDown={layout.onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('previewResizeAriaLabel')}
        >
          <span
            className={[
              'pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-[background-color,opacity] duration-[120ms] ease-[ease]',
              layout.isResizing
                ? 'bg-[var(--border-soft)] opacity-100'
                : 'bg-transparent opacity-100 group-hover:bg-[var(--border-soft)]',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </Box>
      ) : null}

      <Box className="relative h-full w-full overflow-hidden">
        <Box className={layout.slidePanelClassName} onTransitionEnd={layout.onPaneTransitionEnd}>
          <Box className="flex h-[44.5px] flex-col justify-center gap-0 overflow-hidden border-b border-[var(--separator-soft)] bg-transparent px-3">
            <Group className="min-h-full items-center" justify="space-between" wrap="nowrap">
              <Box className="min-w-0 flex-1">
                <Text size="sm" fw={600} className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap leading-[1.25] text-[var(--text-primary)]" title={currentItem?.name ?? undefined}>
                  {currentItem?.name ?? t('loading')}
                </Text>
              </Box>

              {layout.displayPreviewItemId ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  className="ml-1.5 !border !border-transparent !bg-transparent !text-[var(--icon-muted)] transition-[border-color,background-color,color] duration-[120ms] ease-[ease] hover:!border-transparent hover:!bg-[var(--bg-hover-soft)] hover:!text-[var(--icon-strong)]"
                  onClick={onClose}
                  aria-label={t('previewCloseAriaLabel')}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null}
            </Group>
          </Box>

          <Box className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-[var(--bg-sidebar)]">
            {previewBody}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
