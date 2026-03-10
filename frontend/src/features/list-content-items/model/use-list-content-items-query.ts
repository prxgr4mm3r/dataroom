import { useQuery } from '@tanstack/react-query'

import { mapItemResourceDto, type ContentItem } from '@/entities/content-item'
import type { Breadcrumb } from '@/entities/folder'
import { queryKeys } from '@/shared/api'
import type { SortBy, SortOrder } from '@/shared/types/common'

import { listContentItems } from '../api/list-content-items'

type FolderSummary = {
  id: string
  name: string
  parentId: string | null
}

export type ListContentItemsResult = {
  folder: FolderSummary
  breadcrumbs: Breadcrumb[]
  items: ContentItem[]
}

const normalizeParentId = (folderId: string): string | null =>
  folderId === 'root' ? 'root' : folderId

const getFolderIdFromListItemsQueryKey = (queryKey: readonly unknown[]): string | null => {
  if (queryKey.length < 3) {
    return null
  }

  const [scope, entity, keyFolderId] = queryKey
  if (scope !== 'dataroom' || entity !== 'items' || typeof keyFolderId !== 'string') {
    return null
  }

  return keyFolderId
}

export const useListContentItemsQuery = (
  folderId: string,
  sortBy: SortBy,
  sortOrder: SortOrder,
  enabled = true,
) =>
  useQuery<ListContentItemsResult>({
    queryKey: queryKeys.listItems(folderId, sortBy, sortOrder),
    staleTime: 5_000,
    placeholderData: (previousData, previousQuery) => {
      if (!previousData || !previousQuery) {
        return undefined
      }

      const previousFolderId = getFolderIdFromListItemsQueryKey(previousQuery.queryKey)
      if (previousFolderId !== folderId) {
        return undefined
      }

      return previousData
    },
    queryFn: async () => {
      const response = await listContentItems({
        parent_id: normalizeParentId(folderId),
        sort_by: sortBy,
        sort_order: sortOrder,
      })

      return {
        folder: {
          id: response.folder.id,
          name: response.folder.name,
          parentId: response.folder.parent_id,
        },
        breadcrumbs: response.breadcrumbs.map((crumb) => ({ id: crumb.id, name: crumb.name })),
        items: response.items.map(mapItemResourceDto),
      }
    },
    enabled,
  })
