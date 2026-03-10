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
        <Box className="preview-pane__preview-empty">
          <Text c="dimmed">{t('previewNoVisualForFolder')}</Text>
        </Box>
      )
    }

    const inline = isInlinePreviewableMime(currentItem.mimeType)
    const isImage = currentItem.mimeType?.startsWith('image/')
    const isPdf = currentItem.mimeType === 'application/pdf'

    if (!inline) {
      return (
        <Alert color="yellow" title="Unsupported preview">
          {t('previewUnsupported')}
        </Alert>
      )
    }

    if (layout.isOpeningAnimationPending && !contentError) {
      if (isPdf) {
        return (
          <Box className="preview-pane__frame-shell">
            <Box className="preview-pane__frame-loader">
              <Loader />
            </Box>
          </Box>
        )
      }

      return (
        <Box className="preview-pane__preview-empty">
          <Loader />
        </Box>
      )
    }

    if (contentPending) {
      if (isPdf) {
        return (
          <Box className="preview-pane__frame-shell">
            <Box className="preview-pane__frame-loader">
              <Loader />
            </Box>
          </Box>
        )
      }

      return (
        <Box className="preview-pane__preview-empty">
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
        <Alert color="orange" title="Preview error">
          {message}
        </Alert>
      )
    }

    if (!currentContent || !currentContentObjectUrl) {
      return (
        <Box className="preview-pane__preview-empty">
          <Text c="dimmed">{t('previewEmpty')}</Text>
        </Box>
      )
    }

    if (isImage) {
      return <img src={currentContentObjectUrl} alt={currentItem.name} className="preview-pane__image" />
    }

    if (isPdf) {
      const previewSource = `${currentContentObjectUrl}#zoom=page-width`
      const showPdfFrame = layout.canRenderHeavyPreview && !layout.isResizing

      return (
        <Box className="preview-pane__frame-shell">
          {showPdfFrame ? (
            <iframe title={currentItem.name} src={previewSource} className="preview-pane__frame--embedded" />
          ) : null}
          {!showPdfFrame ? (
            <Box className="preview-pane__frame-loader">
              <Loader size="sm" />
            </Box>
          ) : null}
        </Box>
      )
    }

    if (!layout.canRenderHeavyPreview) {
      return (
        <Box className="preview-pane__preview-empty">
          <Loader size="sm" />
        </Box>
      )
    }

    return <iframe title={currentItem.name} src={currentContentObjectUrl} className="preview-pane__frame" />
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
        <Box className="preview-pane__state">
          <Loader />
        </Box>
      )
    } else if (itemError) {
      const apiError = toApiError(itemError)
      previewBody = (
        <Box className="preview-pane__state preview-pane__state--pad">
          <Alert color="red" title="Preview metadata error">
            {apiError.message}
          </Alert>
        </Box>
      )
    } else {
      previewBody = (
        <Box className="preview-pane__tabs-panel">
          <Stack gap="md">
            <Box className="preview-pane__preview-card">{previewVisual}</Box>

            <Box>
              <Text size="xs" fw={700} className="preview-pane__section-title">
                {t('previewActionsTitle')}
              </Text>
              <Group grow className="preview-pane__actions-grid" mt={8}>
                <Button
                  size="xs"
                  variant="default"
                  className="preview-pane__action-button"
                  leftSection={<IconExternalLink size={14} />}
                  onClick={handleOpenInNewTab}
                  disabled={!canOpenInBrowser}
                >
                  {t('previewActionOpen')}
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  className="preview-pane__action-button"
                  leftSection={<IconDownload size={14} />}
                  onClick={handleDownload}
                  disabled={!canDownloadFile}
                >
                  {t('previewActionDownload')}
                </Button>
              </Group>
            </Box>

            <Box className="preview-pane__details-list">
              {detailsRows.map((row) => (
                <Box key={row.label} className="preview-pane__details-row">
                  <Text size="xs" c="dimmed" className="preview-pane__details-label">
                    {row.label}
                  </Text>
                  <Text size="sm" className="preview-pane__details-value" title={row.value}>
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
          className="preview-pane__resizer"
          onPointerDown={layout.onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview panel"
        />
      ) : null}

      <Box className="preview-pane__slide-viewport">
        <Box className={layout.slidePanelClassName} onTransitionEnd={layout.onPaneTransitionEnd}>
          <Box className="preview-pane__header">
            <Group className="preview-pane__header-top" justify="space-between" wrap="nowrap">
              <Box className="preview-pane__heading-block">
                <Text size="sm" fw={600} className="preview-pane__file-name" title={currentItem?.name ?? undefined}>
                  {currentItem?.name ?? 'Loading...'}
                </Text>
              </Box>

              {layout.displayPreviewItemId ? (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  className="preview-pane__icon-btn preview-pane__icon-btn--close"
                  onClick={onClose}
                  aria-label="Close preview"
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null}
            </Group>
          </Box>

          <Box className="preview-pane__body">{previewBody}</Box>
        </Box>
      </Box>
    </Box>
  )
}
