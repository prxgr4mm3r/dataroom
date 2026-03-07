import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { IconDownload, IconExternalLink, IconX } from '@tabler/icons-react'

import { useCloseFilePreview } from '@/features/open-file-preview'
import { useItemContentQuery, useItemQuery } from '@/features/load-item-content'
import { t } from '@/shared/i18n/messages'
import { downloadBlob } from '@/shared/lib/file/download-blob'
import { getFileTypePresentation } from '@/shared/lib/file/file-type-presentation'
import { isInlinePreviewableMime } from '@/shared/lib/file/is-previewable-file'
import { toApiError } from '@/shared/api'
import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@/shared/ui'
import './preview-pane.css'

type PreviewPaneProps = {
  folderId: string
  previewItemId: string | null
}

const PREVIEW_MIN_WIDTH = 320
const PREVIEW_MAX_WIDTH = 760
const PREVIEW_ANIMATION_MS = 220

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

export const PreviewPane = ({ folderId, previewItemId }: PreviewPaneProps) => {
  const [width, setWidth] = useState(420)
  const [isRendered, setIsRendered] = useState(Boolean(previewItemId))
  const [isOpen, setIsOpen] = useState(Boolean(previewItemId))
  const [isResizing, setIsResizing] = useState(false)
  const [displayPreviewItemId, setDisplayPreviewItemId] = useState<string | null>(previewItemId)
  const closeTimerRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const closePreview = useCloseFilePreview(folderId)

  const itemQuery = useItemQuery(displayPreviewItemId)
  const itemContentQuery = useItemContentQuery(displayPreviewItemId)

  const cancelScheduledFrame = () => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  useEffect(
    () => () => {
      cancelScheduledFrame()
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

      animationFrameRef.current = window.requestAnimationFrame(() => {
        setDisplayPreviewItemId(previewItemId)
        setIsRendered(true)
        animationFrameRef.current = window.requestAnimationFrame(() => {
          setIsOpen(true)
          animationFrameRef.current = null
        })
      })
      return
    }

    if (!isRendered) {
      return
    }

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
  }, [isRendered, previewItemId])

  useEffect(() => {
    if (!isResizing || !isOpen) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStartRef.current) {
        return
      }

      const deltaX = dragStartRef.current.startX - event.clientX
      setWidth(clamp(dragStartRef.current.startWidth + deltaX, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH))
    }

    const stopResizing = () => {
      setIsResizing(false)
      dragStartRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
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

  const previewBody = useMemo(() => {
    if (!displayPreviewItemId) {
      return null
    }

    if (itemQuery.isPending) {
      return (
        <Paper h="100%" p="md" radius={0}>
          <Loader />
        </Paper>
      )
    }

    if (itemQuery.error) {
      const apiError = toApiError(itemQuery.error)
      return (
        <Paper h="100%" p="md" radius={0}>
          <Alert color="red" title="Preview metadata error">
            {apiError.message}
          </Alert>
        </Paper>
      )
    }

    const item = itemQuery.data
    const fileTypePresentation = getFileTypePresentation(item.name, item.mimeType)

    if (item.kind === 'folder') {
      return (
        <Paper h="100%" p="md" radius={0}>
          <Text c="dimmed">{t('previewUnsupported')}</Text>
        </Paper>
      )
    }

    if (itemContentQuery.isPending) {
      return (
        <Paper h="100%" p="md" radius={0}>
          <Loader />
        </Paper>
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
        <Paper h="100%" p="md" radius={0}>
          <Alert color="orange" title="Preview error">
            {message}
          </Alert>
        </Paper>
      )
    }

    const content = itemContentQuery.data
    if (!content) {
      return (
        <Paper h="100%" p="md" radius={0}>
          <Text c="dimmed">{t('previewEmpty')}</Text>
        </Paper>
      )
    }

    const inline = isInlinePreviewableMime(item.mimeType)
    const isImage = item.mimeType?.startsWith('image/')

    return (
      <Paper h="100%" p="md" radius={0}>
        <Stack h="100%">
          <Group justify="space-between" align="start">
            <div>
              <Title order={5}>{item.name}</Title>
              <Text size="xs" c="dimmed">
                {fileTypePresentation.label}
              </Text>
            </div>
            <Group gap={6}>
              <Tooltip label={t('previewOpenNewTab')}>
                <Button
                  size="compact-sm"
                  variant="default"
                  onClick={() => window.open(content.objectUrl, '_blank', 'noopener,noreferrer')}
                >
                  <IconExternalLink size={14} />
                </Button>
              </Tooltip>
              <Tooltip label={t('previewDownload')}>
                <Button
                  size="compact-sm"
                  variant="default"
                  onClick={() => downloadBlob(content.blob, item.name)}
                >
                  <IconDownload size={14} />
                </Button>
              </Tooltip>
            </Group>
          </Group>

          {!inline ? (
            <Alert color="yellow" title="Unsupported preview">
              {t('previewUnsupported')}
            </Alert>
          ) : isImage ? (
            <Box style={{ overflow: 'auto', flex: 1 }}>
              <img src={content.objectUrl} alt={item.name} style={{ maxWidth: '100%', borderRadius: 8 }} />
            </Box>
          ) : (
            <iframe
              title={item.name}
              src={content.objectUrl}
              style={{ border: '1px solid var(--border-soft)', borderRadius: 8, flex: 1, minHeight: 240 }}
            />
          )}
        </Stack>
      </Paper>
    )
  }, [
    displayPreviewItemId,
    itemContentQuery.data,
    itemContentQuery.error,
    itemContentQuery.isPending,
    itemQuery.data,
    itemQuery.error,
    itemQuery.isPending,
  ])

  const onResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isOpen || event.button !== 0) {
      return
    }

    event.preventDefault()
    dragStartRef.current = {
      startX: event.clientX,
      startWidth: width,
    }
    setIsResizing(true)
  }

  if (!isRendered) {
    return null
  }

  const paneClassName = [
    'preview-pane',
    isOpen ? 'preview-pane--open' : 'preview-pane--closed',
    isResizing ? 'preview-pane--resizing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Box
      className={paneClassName}
      style={{
        width: isOpen ? width : 0,
      }}
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

      <Group className="preview-pane__header" justify="space-between" px="sm" py={8}>
        <Text size="sm" fw={600}>
          Preview
        </Text>
        {displayPreviewItemId ? (
          <Button size="compact-sm" variant="subtle" onClick={() => closePreview()}>
            <IconX size={14} />
          </Button>
        ) : null}
      </Group>

      <Box className="preview-pane__body">{previewBody}</Box>
    </Box>
  )
}
