import { useEffect, useRef } from 'react'

import type { ContentItem } from '@/entities/content-item'
import { getSelectionRangeIds, useSelectionStore } from '@/features/select-content-items'

type UseDataroomSelectionParams = {
  normalizedFolderId: string
  items: ContentItem[]
  orderedItemIds: string[]
  itemMap: Map<string, ContentItem>
}

export const useDataroomSelection = ({
  normalizedFolderId,
  items,
  orderedItemIds,
  itemMap,
}: UseDataroomSelectionParams) => {
  const selectionAnchorIdRef = useRef<string | null>(null)

  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const toggleSelected = useSelectionStore((state) => state.toggle)
  const clearSelection = useSelectionStore((state) => state.clear)
  const setSelected = useSelectionStore((state) => state.setMany)

  const clearSelectedItems = () => {
    clearSelection()
    selectionAnchorIdRef.current = null
  }

  useEffect(() => {
    clearSelection()
    selectionAnchorIdRef.current = null
  }, [clearSelection, normalizedFolderId])

  const setSelectedAndSyncAnchor = (ids: string[]) => {
    const uniqueIds = [...new Set(ids)]
    setSelected(uniqueIds)
    const currentAnchorId = selectionAnchorIdRef.current
    selectionAnchorIdRef.current =
      currentAnchorId && uniqueIds.includes(currentAnchorId)
        ? currentAnchorId
        : uniqueIds[0] ?? null
  }

  const getSingleSelectedItem = (): ContentItem | null => {
    if (selectedIds.length !== 1) {
      return null
    }
    return itemMap.get(selectedIds[0]) ?? null
  }

  const handleToggleSelect = (
    itemId: string,
    options?: {
      range?: boolean
      keepExisting?: boolean
    },
  ) => {
    if (options?.range) {
      const rangeIds = getSelectionRangeIds(
        orderedItemIds,
        selectionAnchorIdRef.current,
        itemId,
      )
      if (rangeIds.length) {
        setSelectedAndSyncAnchor(
          options.keepExisting ? [...selectedIds, ...rangeIds] : rangeIds,
        )
      }
      return
    }

    toggleSelected(itemId)
    selectionAnchorIdRef.current = itemId
  }

  const selectAllVisibleItems = () => {
    const nextSelectedIds = items.map((item) => item.id)
    setSelectedAndSyncAnchor(nextSelectedIds)
  }

  const excludeIdsFromSelection = (excludedIds: string[]) => {
    if (!excludedIds.length) {
      return
    }
    setSelectedAndSyncAnchor(
      selectedIds.filter((id) => !excludedIds.includes(id)),
    )
  }

  return {
    selectedIds,
    clearSelectedItems,
    setSelectedAndSyncAnchor,
    getSingleSelectedItem,
    handleToggleSelect,
    selectAllVisibleItems,
    excludeIdsFromSelection,
  }
}
