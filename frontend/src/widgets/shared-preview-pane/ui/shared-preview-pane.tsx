import { useQuery } from '@tanstack/react-query'

import { mapItemResourceDto, type ContentItem } from '@/entities/content-item'
import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'
import { resolveInlineBlob } from '@/shared/lib/file/resolve-inline-blob'
import { PreviewPaneView } from '@/shared/lib/preview/preview-pane-view'
import { usePreviewPaneLayout } from '@/shared/lib/preview/use-preview-pane-layout'

import '@/widgets/preview-pane/ui/preview-pane.css'

type SharedPreviewPaneProps = {
  shareToken: string
  previewItemId: string | null
  onClose: () => void
}

type SharedItemContentResult = {
  blob: Blob
}

const PREVIEW_ANIMATION_MS = 220

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
  }
}

export const SharedPreviewPane = ({ shareToken, previewItemId, onClose }: SharedPreviewPaneProps) => {
  const layout = usePreviewPaneLayout({
    previewItemId,
    animationMs: PREVIEW_ANIMATION_MS,
  })

  const itemQuery = useQuery({
    queryKey: ['shared-item', shareToken, layout.displayPreviewItemId],
    queryFn: async () => getSharedItem(shareToken, String(layout.displayPreviewItemId)),
    enabled: Boolean(shareToken) && Boolean(layout.displayPreviewItemId),
  })
  const currentItem = itemQuery.data
  const shouldLoadPreviewContent = layout.isOpen && currentItem?.kind === 'file'

  const itemContentQuery = useQuery({
    queryKey: ['shared-item-content', shareToken, layout.displayPreviewItemId, currentItem?.mimeType ?? 'none'],
    queryFn: async () =>
      getSharedItemContent(shareToken, String(layout.displayPreviewItemId), currentItem?.mimeType),
    enabled: Boolean(shareToken) && Boolean(layout.displayPreviewItemId) && shouldLoadPreviewContent,
    gcTime: 0,
  })

  return (
    <PreviewPaneView
      layout={layout}
      currentItem={currentItem}
      itemPending={itemQuery.isPending}
      itemError={itemQuery.error}
      currentContent={itemContentQuery.data}
      contentPending={itemContentQuery.isPending}
      contentError={itemContentQuery.error}
      onClose={onClose}
    />
  )
}
