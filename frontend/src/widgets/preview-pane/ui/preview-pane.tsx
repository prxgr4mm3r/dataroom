import { useItemContentQuery, useItemQuery } from '@/features/load-item-content'
import { useCloseFilePreview } from '@/features/open-file-preview'
import { usePreviewPaneLayout } from '@/shared/lib/preview/use-preview-pane-layout'
import { PreviewPaneView } from './preview-pane-view'

type PreviewPaneProps = {
  folderId: string
  previewItemId: string | null
}

const PREVIEW_ANIMATION_MS = 220

export const PreviewPane = ({ folderId, previewItemId }: PreviewPaneProps) => {
  const closePreview = useCloseFilePreview(folderId)
  const layout = usePreviewPaneLayout({
    previewItemId,
    animationMs: PREVIEW_ANIMATION_MS,
  })

  const itemQuery = useItemQuery(layout.displayPreviewItemId)
  const currentItem = itemQuery.data
  const shouldLoadPreviewContent = layout.isOpen && currentItem?.kind === 'file'
  const itemContentQuery = useItemContentQuery(
    layout.displayPreviewItemId,
    currentItem?.mimeType,
    shouldLoadPreviewContent,
  )

  return (
    <PreviewPaneView
      layout={layout}
      currentItem={currentItem}
      itemPending={itemQuery.isPending}
      itemError={itemQuery.error}
      currentContent={itemContentQuery.data}
      contentPending={itemContentQuery.isPending}
      contentError={itemContentQuery.error}
      onClose={closePreview}
    />
  )
}
