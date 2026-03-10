import { useQuery } from '@tanstack/react-query'

import { mapItemResourceDto, type ContentItem } from '@/entities/content-item'
import { queryKeys } from '@/shared/api'

import { getItem } from '../api/get-item'

export const useItemQuery = (itemId: string | null) =>
  useQuery<ContentItem>({
    queryKey: queryKeys.item(itemId || 'none'),
    queryFn: async () => mapItemResourceDto(await getItem(itemId!)),
    enabled: Boolean(itemId),
    staleTime: 10_000,
  })
