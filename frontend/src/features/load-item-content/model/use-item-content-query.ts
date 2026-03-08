import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { getItemContent } from '../api/get-item-content'

export type ItemContentResult = {
  blob: Blob
  contentType: string
  objectUrl: string
}

export const useItemContentQuery = (itemId: string | null, enabled = true) =>
  useQuery<ItemContentResult>({
    queryKey: queryKeys.itemContent(itemId || 'none'),
    queryFn: async () => {
      const payload = await getItemContent(itemId!)
      return {
        ...payload,
        objectUrl: URL.createObjectURL(payload.blob),
      }
    },
    enabled: Boolean(itemId) && enabled,
    gcTime: 0,
  })
