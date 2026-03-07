import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { IconDownload, IconExternalLink, IconX } from '@tabler/icons-react'

import { useCloseFilePreview } from '@/features/open-file-preview'
import { useItemContentQuery, useItemQuery } from '@/features/load-item-content'
import { t } from '@/shared/i18n/messages'
import { downloadBlob } from '@/shared/lib/file/download-blob'
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

type PreviewPaneProps = {
  folderId: string
  previewItemId: string | null
}

const PREVIEW_MIN_WIDTH = 320
const PREVIEW_MAX_WIDTH = 760

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

export const PreviewPane = ({ folderId, previewItemId }: PreviewPaneProps) => {
  const [width, setWidth] = useState(420)
  const closePreview = useCloseFilePreview(folderId)

  const itemQuery = useItemQuery(previewItemId)
  const itemContentQuery = useItemContentQuery(previewItemId)

  useEffect(() => {
    const objectUrl = itemContentQuery.data?.objectUrl
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [itemContentQuery.data?.objectUrl])

  const previewBody = useMemo(() => {
    if (!previewItemId) {
      return (
        <Paper h="100%" p="md" radius={0}>
          <Text c="dimmed">{t('previewEmpty')}</Text>
        </Paper>
      )
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
                {item.mimeType || 'Unknown type'}
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
  }, [itemContentQuery.data, itemContentQuery.error, itemContentQuery.isPending, itemQuery.data, itemQuery.error, itemQuery.isPending, previewItemId])

  const onResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    const startX = event.clientX
    const startWidth = width

    const onMove = (moveEvent: globalThis.MouseEvent) => {
      const delta = startX - moveEvent.clientX
      setWidth(clamp(startWidth + delta, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <Box
      style={{
        width: previewItemId ? width : 280,
        borderLeft: '1px solid var(--border-soft)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--bg-surface)',
      }}
    >
      {previewItemId ? (
        <Box
          onMouseDown={onResizeStart}
          style={{
            position: 'absolute',
            left: -2,
            top: 0,
            width: 4,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 20,
          }}
        />
      ) : null}

      <Group justify="space-between" px="sm" py={8} style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <Text size="sm" fw={600}>
          Preview
        </Text>
        {previewItemId ? (
          <Button size="compact-sm" variant="subtle" onClick={() => closePreview()}>
            <IconX size={14} />
          </Button>
        ) : null}
      </Group>

      <Box style={{ flex: 1, minHeight: 0 }}>{previewBody}</Box>
    </Box>
  )
}
