import { apiClient } from '@/shared/api'

import type { ShareLinkDto } from './list-share-links'

type CreateShareLinkPayload = {
  itemId: string
  expiresInDays?: number
}

type CreateShareLinkResponseDto = Omit<ShareLinkDto, 'updated_at' | 'revoked_at' | 'last_access_at'> & {
  share_url: string
}

export const createShareLink = async ({
  itemId,
  expiresInDays,
}: CreateShareLinkPayload): Promise<CreateShareLinkResponseDto> => {
  const response = await apiClient.post<CreateShareLinkResponseDto>('/api/shares', {
    item_id: itemId,
    expires_in_days: expiresInDays,
  })
  return response.data
}
