import { useQuery } from '@tanstack/react-query'
import { IconDownload, IconExternalLink, IconX } from '@tabler/icons-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from 'react'

import { mapItemResourceDto, type ContentItem } from '@/entities/content-item'
import { apiClient, toApiError } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'
import { formatDate } from '@/shared/lib/date/format-date'
import { downloadBlob } from '@/shared/lib/file/download-blob'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { isInlinePreviewableMime } from '@/shared/lib/file/is-previewable-file'
import { resolveInlineBlob } from '@/shared/lib/file/resolve-inline-blob'
import { t } from '@/shared/i18n/messages'
import { ActionIcon, Alert, Box, Button, Group, Loader, Stack, Text } from '@/shared/ui'

import '@/widgets/preview-pane/ui/preview-pane.css'

type SharedPreviewPaneProps = {
  shareToken: string
  previewItemId: string | null
  onClose: () => void
}

type SharedItemContentResult = {
  blob: Blob
  objectUrl: string
}

const PREVIEW_MIN_WIDTH = 320
const PREVIEW_MAX_WIDTH = 760
const PREVIEW_DEFAULT_WIDTH = 480
const PREVIEW_ANIMATION_MS = 220

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const getPreviewMaxWidth = (): number => {
  if (typeof window === 'undefined') {
    return PREVIEW_MAX_WIDTH
  }

  return clamp(Math.floor(window.innerWidth * 0.62), PREVIEW_MIN_WIDTH + 24, PREVIEW_MAX_WIDTH)
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

const getSharedItem = async (shareToken: string, itemId: string): Promise<ContentItem> => {
  const response = await apiClient.get<ItemResourceDto>(
    `/api/public/shares/${encodeURIComponent(shareToken)}/items/${itemId}`,
  )
  return mapItemResourceDto(response.data)
}

const getSharedItemContent = async (
  shareToken: string,
  itemId: string,
  expectedMimeType?: string | null,
): Promise<SharedItemContentResult> => {
  const response = await apiClient.get<Blob>(
    `/api/public/shares/${encodeURIComponent(shareToken)}/items/${itemId}/content`,
    { responseType: 'blob' },
  )

  const blob = resolveInlineBlob(response.data, {
    headerContentType: response.headers['content-type'],
    fallbackContentType: expectedMimeType,
  })

  return {
    blob,
    objectUrl: URL.createObjectURL(blob),
  }
}

export const SharedPreviewPane = ({ shareToken, previewItemId, onClose }: SharedPreviewPaneProps) => {
  const [width, setWidth] = useState(PREVIEW_DEFAULT_WIDTH)
  const [isRendered, setIsRendered] = useState(Boolean(previewItemId))
  const [isOpen, setIsOpen] = useState(Boolean(previewItemId))
  const [isResizing, setIsResizing] = useState(false)
  const [displayPreviewItemId, setDisplayPreviewItemId] = useState<string | null>(previewItemId)
  const [isOpeningAnimationPending, setIsOpeningAnimationPending] = useState(false)
  const [canRenderHeavyPreview, setCanRenderHeavyPreview] = useState(Boolean(previewItemId))
  const closeTimerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const resizeAnimationFrameRef = useRef<number | null>(null)
  const pendingResizeWidthRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const itemQuery = useQuery({
    queryKey: ['shared-item', shareToken, displayPreviewItemId],
    queryFn: async () => getSharedItem(shareToken, String(displayPreviewItemId)),
    enabled: Boolean(shareToken) && Boolean(displayPreviewItemId),
  })
  const currentItem = itemQuery.data
  const shouldLoadPreviewContent = isOpen && currentItem?.kind === 'file'

  const itemContentQuery = useQuery({
    queryKey: ['shared-item-content', shareToken, displayPreviewItemId, currentItem?.mimeType ?? 'none'],
    queryFn: async () => getSharedItemContent(shareToken, String(displayPreviewItemId), currentItem?.mimeType),
    enabled: Boolean(shareToken) && Boolean(displayPreviewItemId) && shouldLoadPreviewContent,
    gcTime: 0,
  })

  const currentContent = itemContentQuery.data

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

  const canUseFileActions = Boolean(currentItem && currentItem.kind === 'file' && currentContent)

  const cancelScheduledFrame = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  const cancelResizeFrame = () => {
    if (resizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeAnimationFrameRef.current)
      resizeAnimationFrameRef.current = null
    }
    pendingResizeWidthRef.current = null
  }

  useEffect(
    () => () => {
      cancelScheduledFrame()
      cancelResizeFrame()
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    cancelScheduledFrame()

    if (previewItemId) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }

      if (!isRendered) {
        setCanRenderHeavyPreview(false)
        setIsOpeningAnimationPending(true)
        setDisplayPreviewItemId(previewItemId)
        setIsRendered(true)
        setIsOpen(false)
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = window.requestAnimationFrame(() => {
            setIsOpen(true)
            animationFrameRef.current = null
          })
        })
      } else {
        setDisplayPreviewItemId(previewItemId)
        if (isOpen) {
          setIsOpeningAnimationPending(false)
          setCanRenderHeavyPreview(true)
        } else {
          setCanRenderHeavyPreview(false)
          setIsOpeningAnimationPending(true)
          animationFrameRef.current = window.requestAnimationFrame(() => {
            setIsOpen(true)
            animationFrameRef.current = null
          })
        }
      }
      return
    }

    if (!isRendered) {
      return
    }

    setIsOpeningAnimationPending(false)
    setCanRenderHeavyPreview(false)
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setIsOpen(false)
      animationFrameRef.current = null
    })
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsRendered(false)
      setDisplayPreviewItemId(null)
      closeTimerRef.current = null
    }, PREVIEW_ANIMATION_MS)
  }, [isOpen, isRendered, previewItemId])

  useEffect(() => {
    if (!isOpeningAnimationPending) {
      return
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeoutMs = prefersReducedMotion ? 0 : PREVIEW_ANIMATION_MS + 34
    const timeoutId = window.setTimeout(() => {
      setIsOpeningAnimationPending(false)
      setCanRenderHeavyPreview(true)
    }, timeoutMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isOpeningAnimationPending])

  useEffect(() => {
    const handleResize = () => {
      setWidth((currentWidth) => clamp(currentWidth, PREVIEW_MIN_WIDTH, getPreviewMaxWidth()))
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isResizing || !isOpen) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStartRef.current) {
        return
      }

      const deltaX = dragStartRef.current.startX - event.clientX
      pendingResizeWidthRef.current = clamp(
        dragStartRef.current.startWidth + deltaX,
        PREVIEW_MIN_WIDTH,
        getPreviewMaxWidth(),
      )
      if (resizeAnimationFrameRef.current !== null) {
        return
      }

      resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        resizeAnimationFrameRef.current = null
        if (pendingResizeWidthRef.current === null) {
          return
        }
        setWidth(pendingResizeWidthRef.current)
        pendingResizeWidthRef.current = null
      })
    }

    const stopResizing = () => {
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current)
        resizeAnimationFrameRef.current = null
      }
      if (pendingResizeWidthRef.current !== null) {
        setWidth(pendingResizeWidthRef.current)
        pendingResizeWidthRef.current = null
      }
      setIsResizing(false)
      dragStartRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      cancelResizeFrame()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }
  }, [isOpen, isResizing])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    document.body.classList.add('preview-pane-resizing')

    return () => {
      document.body.classList.remove('preview-pane-resizing')
    }
  }, [isResizing])

  useEffect(() => {
    const objectUrl = itemContentQuery.data?.objectUrl
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [itemContentQuery.data?.objectUrl])

  const handleOpenInNewTab = () => {
    if (!currentContent) {
      return
    }

    window.open(currentContent.objectUrl, '_blank', 'noopener,noreferrer')
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

    if (isOpeningAnimationPending && !itemContentQuery.error) {
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

    if (itemContentQuery.isPending) {
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

    if (itemContentQuery.error) {
      const apiError = toApiError(itemContentQuery.error)
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

    if (!currentContent) {
      return (
        <Box className="preview-pane__preview-empty">
          <Text c="dimmed">{t('previewEmpty')}</Text>
        </Box>
      )
    }

    if (isImage) {
      return <img src={currentContent.objectUrl} alt={currentItem.name} className="preview-pane__image" />
    }

    if (isPdf) {
      const previewSource = `${currentContent.objectUrl}#zoom=page-width`
      const showPdfFrame = canRenderHeavyPreview && !isResizing

      return (
        <Box className="preview-pane__frame-shell">
          {showPdfFrame ? <iframe title={currentItem.name} src={previewSource} className="preview-pane__frame--embedded" /> : null}
          {!showPdfFrame ? (
            <Box className="preview-pane__frame-loader">
              <Loader size="sm" />
            </Box>
          ) : null}
        </Box>
      )
    }

    if (!canRenderHeavyPreview) {
      return (
        <Box className="preview-pane__preview-empty">
          <Loader size="sm" />
        </Box>
      )
    }

    return <iframe title={currentItem.name} src={currentContent.objectUrl} className="preview-pane__frame" />
  }, [
    canRenderHeavyPreview,
    currentContent,
    currentItem,
    isOpeningAnimationPending,
    isResizing,
    itemContentQuery.error,
    itemContentQuery.isPending,
    shouldLoadPreviewContent,
  ])

  let previewBody = null

  if (displayPreviewItemId) {
    if (itemQuery.isPending) {
      previewBody = (
        <Box className="preview-pane__state">
          <Loader />
        </Box>
      )
    } else if (itemQuery.error) {
      const apiError = toApiError(itemQuery.error)
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
                  disabled={!canUseFileActions}
                >
                  {t('previewActionOpen')}
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  className="preview-pane__action-button"
                  leftSection={<IconDownload size={14} />}
                  onClick={handleDownload}
                  disabled={!canUseFileActions}
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

  const onResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isOpen || event.button !== 0) {
      return
    }

    event.preventDefault()
    dragStartRef.current = {
      startX: event.clientX,
      startWidth: clamp(width, PREVIEW_MIN_WIDTH, getPreviewMaxWidth()),
    }
    setIsResizing(true)
  }

  if (!isRendered) {
    return null
  }

  const handlePaneTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return
    }

    if (!isOpen || !isOpeningAnimationPending) {
      return
    }

    setIsOpeningAnimationPending(false)
    setCanRenderHeavyPreview(true)
  }

  const paneClassName = [
    'preview-pane',
    isOpen ? 'preview-pane--open' : 'preview-pane--closed',
    isResizing ? 'preview-pane--resizing' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const slidePanelClassName = [
    'preview-pane__slide-panel',
    isOpen ? 'preview-pane__slide-panel--open' : 'preview-pane__slide-panel--closed',
  ]
    .filter(Boolean)
    .join(' ')
  const openWidth = clamp(width, PREVIEW_MIN_WIDTH, getPreviewMaxWidth())

  return (
    <Box
      className={paneClassName}
      style={
        {
          width: isOpen ? openWidth : 0,
          '--preview-pane-open-width': `${openWidth}px`,
        } as CSSProperties
      }
    >
      {isOpen ? (
        <Box
          className="preview-pane__resizer"
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview panel"
        />
      ) : null}

      <Box className="preview-pane__slide-viewport">
        <Box className={slidePanelClassName} onTransitionEnd={handlePaneTransitionEnd}>
          <Box className="preview-pane__header">
            <Group className="preview-pane__header-top" justify="space-between" wrap="nowrap">
              <Box className="preview-pane__heading-block">
                <Text size="sm" fw={600} className="preview-pane__file-name" title={currentItem?.name ?? undefined}>
                  {currentItem?.name ?? 'Loading...'}
                </Text>
              </Box>

              {displayPreviewItemId ? (
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
