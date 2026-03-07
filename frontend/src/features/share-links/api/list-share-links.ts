import { apiClient } from '@/shared/api'

export type ShareLinkDto = {
  id: string
  permission: string
  root_item_id: string
  expires_at: string | null
  created_at: string
  updated_at: string
  revoked_at: string | null
  last_access_at: string | null
  share_url: string | null
}

type ListShareLinksResponseDto = {
  items: ShareLinkDto[]
}

export const listShareLinks = async (itemId: string): Promise<ShareLinkDto[]> => {
  const response = await apiClient.get<ListShareLinksResponseDto>('/api/shares', {
    params: { item_id: itemId },
  })
  return response.data.items
}
