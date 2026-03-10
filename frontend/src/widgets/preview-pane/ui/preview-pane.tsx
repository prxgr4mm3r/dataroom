import {
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from 'react'
import { IconDownload, IconExternalLink, IconX } from '@tabler/icons-react'

import { useCloseFilePreview } from '@/features/open-file-preview'
import { useItemContentQuery, useItemQuery } from '@/features/load-item-content'
import { toApiError } from '@/shared/api'
import { formatDate } from '@/shared/lib/date/format-date'
import { downloadBlob } from '@/shared/lib/file/download-blob'
import { formatFileSize } from '@/shared/lib/file/format-file-size'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { isInlinePreviewableMime } from '@/shared/lib/file/is-previewable-file'
import { t } from '@/shared/i18n/messages'
import { ActionIcon, Alert, Box, Button, Group, Loader, Stack, Text } from '@/shared/ui'

import './preview-pane.css'

type PreviewPaneProps = {
  folderId: string
  previewItemId: string | null
}

type PreviewRenderState = {
  isRendered: boolean
  isOpen: boolean
  displayPreviewItemId: string | null
  isOpeningAnimationPending: boolean
  canRenderHeavyPreview: boolean
}

type PreviewRenderAction =
  | { type: 'show_preview_from_closed'; previewItemId: string }
  | { type: 'show_preview_from_open'; previewItemId: string }
  | { type: 'show_preview_while_rendered_closed'; previewItemId: string }
  | { type: 'set_open' }
  | { type: 'begin_close' }
  | { type: 'set_closed' }
  | { type: 'finish_close' }
  | { type: 'mark_ready' }

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

const createInitialPreviewRenderState = (previewItemId: string | null): PreviewRenderState => ({
  isRendered: Boolean(previewItemId),
  isOpen: Boolean(previewItemId),
  displayPreviewItemId: previewItemId,
  isOpeningAnimationPending: false,
  canRenderHeavyPreview: Boolean(previewItemId),
})

const previewRenderReducer = (
  state: PreviewRenderState,
  action: PreviewRenderAction,
): PreviewRenderState => {
  if (action.type === 'show_preview_from_closed') {
    return {
      ...state,
      isRendered: true,
      isOpen: false,
      displayPreviewItemId: action.previewItemId,
      isOpeningAnimationPending: true,
      canRenderHeavyPreview: false,
    }
  }

  if (action.type === 'show_preview_from_open') {
    return {
      ...state,
      isRendered: true,
      isOpen: true,
      displayPreviewItemId: action.previewItemId,
      isOpeningAnimationPending: false,
      canRenderHeavyPreview: true,
    }
  }

  if (action.type === 'show_preview_while_rendered_closed') {
    return {
      ...state,
      displayPreviewItemId: action.previewItemId,
      isOpeningAnimationPending: true,
      canRenderHeavyPreview: false,
    }
  }

  if (action.type === 'set_open') {
    return {
      ...state,
      isOpen: true,
    }
  }

  if (action.type === 'begin_close') {
    return {
      ...state,
      isOpeningAnimationPending: false,
      canRenderHeavyPreview: false,
    }
  }

  if (action.type === 'set_closed') {
    return {
      ...state,
      isOpen: false,
    }
  }

  if (action.type === 'finish_close') {
    return {
      ...state,
      isRendered: false,
      displayPreviewItemId: null,
    }
  }

  if (action.type === 'mark_ready') {
    return {
      ...state,
      isOpeningAnimationPending: false,
      canRenderHeavyPreview: true,
    }
  }

  return state
}

export const PreviewPane = ({ folderId, previewItemId }: PreviewPaneProps) => {
  const [width, setWidth] = useState(PREVIEW_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [renderState, dispatchRender] = useReducer(
    previewRenderReducer,
    previewItemId,
    createInitialPreviewRenderState,
  )
  const { isRendered, isOpen, displayPreviewItemId, isOpeningAnimationPending, canRenderHeavyPreview } =
    renderState
  const closeTimerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const resizeAnimationFrameRef = useRef<number | null>(null)
  const pendingResizeWidthRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const closePreview = useCloseFilePreview(folderId)

  const itemQuery = useItemQuery(displayPreviewItemId)
  const currentItem = itemQuery.data
  const shouldLoadPreviewContent = isOpen && currentItem?.kind === 'file'
  const itemContentQuery = useItemContentQuery(displayPreviewItemId, currentItem?.mimeType, shouldLoadPreviewContent)
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
        dispatchRender({
          type: 'show_preview_from_closed',
          previewItemId,
        })
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = window.requestAnimationFrame(() => {
            dispatchRender({ type: 'set_open' })
            animationFrameRef.current = null
          })
        })
      } else {
        if (isOpen) {
          dispatchRender({
            type: 'show_preview_from_open',
            previewItemId,
          })
        } else {
          dispatchRender({
            type: 'show_preview_while_rendered_closed',
            previewItemId,
          })
          animationFrameRef.current = window.requestAnimationFrame(() => {
            dispatchRender({ type: 'set_open' })
            animationFrameRef.current = null
          })
        }
      }
      return
    }

    if (!isRendered) {
      return
    }

    dispatchRender({ type: 'begin_close' })
    animationFrameRef.current = window.requestAnimationFrame(() => {
      dispatchRender({ type: 'set_closed' })
      animationFrameRef.current = null
    })
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = window.setTimeout(() => {
      dispatchRender({ type: 'finish_close' })
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
      dispatchRender({ type: 'mark_ready' })
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

    dispatchRender({ type: 'mark_ready' })
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
                  onClick={() => closePreview()}
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
