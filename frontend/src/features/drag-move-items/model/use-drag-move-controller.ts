import { useMemo, useRef, useState, type DragEvent } from 'react'

import type { ContentItem } from '@/entities/content-item'
import type { FolderNode } from '@/entities/folder'
import { t } from '@/shared/i18n/messages'
import { createDragPreview } from '@/shared/lib/dnd/create-drag-preview'
import { INTERNAL_DND_ITEMS_TYPE } from '@/shared/lib/dnd/drag-types'
import { normalizeFolderId } from '@/shared/routes/dataroom-routes'

import { validateMoveTarget } from './validators'

type DropState = 'none' | 'valid' | 'invalid'

type UseDragMoveControllerParams = {
  items: ContentItem[]
  selectedIds: string[]
  folderTree: FolderNode | undefined
  onMoveItems: (itemIds: string[], targetFolderId: string) => Promise<void>
  onInvalidDrop: (message: string) => void
}

type DragPayload = {
  itemIds: string[]
  movingItems: ContentItem[]
}

const reasonToMessage = (reason: ReturnType<typeof validateMoveTarget>['reason']): string => {
  if (reason === 'self') {
    return t('invalidMoveSelf')
  }
  if (reason === 'descendant') {
    return t('invalidMoveDescendant')
  }
  if (reason === 'same_parent') {
    return t('invalidMoveSameFolder')
  }
  return t('invalidMoveTarget')
}

export const useDragMoveController = ({
  items,
  selectedIds,
  folderTree,
  onMoveItems,
  onInvalidDrop,
}: UseDragMoveControllerParams) => {
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)
  const [hoverValidation, setHoverValidation] = useState<ReturnType<typeof validateMoveTarget> | null>(null)
  const dragPreviewCleanupRef = useRef<(() => void) | null>(null)

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const startDragInternal = (draggedIds: string[], movingItems: ContentItem[], event: DragEvent<HTMLElement>) => {
    dragPreviewCleanupRef.current?.()
    dragPreviewCleanupRef.current = null

    if (!movingItems.length) {
      return
    }

    setDragPayload({
      itemIds: draggedIds,
      movingItems,
    })

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', draggedIds.join(','))
    event.dataTransfer.setData(INTERNAL_DND_ITEMS_TYPE, '1')

    const previewTitle = movingItems.length === 1 ? movingItems[0].name : `${movingItems.length} items`
    const preview = createDragPreview({
      title: previewTitle,
      count: movingItems.length,
      subtitle: t('dragMoveHint'),
    })

    if (preview) {
      event.dataTransfer.setDragImage(preview.element, 18, 18)
      dragPreviewCleanupRef.current = preview.cleanup
    }
  }

  const startDragFromTable = (itemId: string, event: DragEvent<HTMLTableRowElement>) => {
    const draggedIds = selectedIds.includes(itemId) && selectedIds.length > 0 ? selectedIds : [itemId]
    const movingItems = draggedIds.map((id) => itemMap.get(id)).filter((item): item is ContentItem => Boolean(item))
    startDragInternal(draggedIds, movingItems, event)
  }

  const startDragFromTree = (item: ContentItem, event: DragEvent<HTMLElement>) => {
    startDragInternal([item.id], [item], event)
  }

  const endDrag = () => {
    dragPreviewCleanupRef.current?.()
    dragPreviewCleanupRef.current = null
    setDragPayload(null)
    setHoveredFolderId(null)
    setHoverValidation(null)
  }

  const dragOverFolder = (folderId: string, event: DragEvent<HTMLElement>) => {
    if (!dragPayload) {
      return
    }

    event.preventDefault()

    const normalizedTarget = normalizeFolderId(folderId)
    const validation = validateMoveTarget(dragPayload.movingItems, normalizedTarget, folderTree)

    if (!validation.valid && validation.reason === 'same_parent') {
      event.dataTransfer.dropEffect = 'none'
      setHoveredFolderId(null)
      setHoverValidation(null)
      return
    }

    event.dataTransfer.dropEffect = validation.valid ? 'move' : 'none'

    setHoveredFolderId(normalizedTarget)
    setHoverValidation(validation)
  }

  const dragLeaveFolder = (folderId: string) => {
    const normalizedTarget = normalizeFolderId(folderId)
    if (hoveredFolderId === normalizedTarget) {
      setHoveredFolderId(null)
      setHoverValidation(null)
    }
  }

  const dropOnFolder = async (folderId: string, event: DragEvent<HTMLElement>) => {
    if (!dragPayload) {
      return
    }

    event.preventDefault()

    const normalizedTarget = normalizeFolderId(folderId)
    const validation = validateMoveTarget(dragPayload.movingItems, normalizedTarget, folderTree)

    if (!validation.valid && validation.reason === 'same_parent') {
      endDrag()
      return
    }

    if (!validation.valid) {
      onInvalidDrop(reasonToMessage(validation.reason))
      setHoveredFolderId(normalizedTarget)
      setHoverValidation(validation)
      return
    }

    await onMoveItems(dragPayload.itemIds, normalizedTarget)

    endDrag()
  }

  const getFolderDropState = (folderId: string): DropState => {
    const normalized = normalizeFolderId(folderId)
    if (!hoveredFolderId || hoveredFolderId !== normalized || !hoverValidation) {
      return 'none'
    }
    return hoverValidation.valid ? 'valid' : 'invalid'
  }

  return {
    dragPayload,
    isDragging: Boolean(dragPayload),
    startDragFromTable,
    startDragFromTree,
    endDrag,
    dragOverFolder,
    dragLeaveFolder,
    dropOnFolder,
    getFolderDropState,
    isDraggingItem: (itemId: string) => Boolean(dragPayload?.itemIds.includes(itemId)),
  }
}
