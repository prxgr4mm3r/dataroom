import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { getItemContent } from '../api/get-item-content'

export type ItemContentResult = {
  blob: Blob
  contentType: string
}

export const useItemContentQuery = (itemId: string | null, expectedMimeType?: string | null, enabled = true) =>
  useQuery<ItemContentResult>({
    queryKey: [...queryKeys.itemContent(itemId || 'none'), expectedMimeType ?? 'none'],
    queryFn: async () => getItemContent(itemId!, expectedMimeType),
    enabled: Boolean(itemId) && enabled,
    gcTime: 0,
  })
