import { apiClient } from '@/shared/api'
import type { BulkDeleteResponseDto } from '@/shared/api'

export const bulkDeleteItems = async (itemIds: string[]): Promise<BulkDeleteResponseDto> => {
  const response = await apiClient.post<BulkDeleteResponseDto>('/api/items/bulk-delete', {
    item_ids: itemIds,
  })
  return response.data
}
