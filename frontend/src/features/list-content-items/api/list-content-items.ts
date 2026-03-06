import { apiClient } from '@/shared/api'
import type { ListItemsDto, ListItemsParams } from '@/shared/api'

export const listContentItems = async (params: ListItemsParams): Promise<ListItemsDto> => {
  const response = await apiClient.get<ListItemsDto>('/api/items', {
    params,
  })
  return response.data
}
