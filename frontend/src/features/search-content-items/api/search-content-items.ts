import { mapItemResourceDto, type ContentItem } from '@/entities/content-item'
import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'

type SearchItemsResponse = {
  items: ItemResourceDto[]
}

type SearchContentItemsParams = {
  query: string
  limit?: number
  rootItemId?: string
}

type SearchSharedContentItemsParams = SearchContentItemsParams & {
  shareToken: string
}

const DEFAULT_LIMIT = 50

export const searchContentItems = async ({
  query,
  limit = DEFAULT_LIMIT,
  rootItemId,
}: SearchContentItemsParams): Promise<ContentItem[]> => {
  const response = await apiClient.get<SearchItemsResponse>('/api/items/search', {
    params: {
      q: query,
      limit,
      root_item_id: rootItemId,
    },
  })
  return response.data.items.map(mapItemResourceDto)
}

export const searchSharedContentItems = async ({
  shareToken,
  query,
  limit = DEFAULT_LIMIT,
}: SearchSharedContentItemsParams): Promise<ContentItem[]> => {
  const response = await apiClient.get<SearchItemsResponse>(
    `/api/public/shares/${encodeURIComponent(shareToken)}/search`,
    {
      params: {
        q: query,
        limit,
      },
    },
  )
  return response.data.items.map(mapItemResourceDto)
}
