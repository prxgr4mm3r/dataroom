import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { listShareLinks, type ShareLinkDto } from '../api/list-share-links'

export const useShareLinksQuery = (itemId: string | null, enabled = true) =>
  useQuery<ShareLinkDto[]>({
    queryKey: queryKeys.sharesByItem(itemId ?? 'none'),
    queryFn: async () => listShareLinks(String(itemId)),
    enabled: Boolean(itemId) && enabled,
  })
