import { apiClient } from '@/shared/api'
import type { BulkItemsResponseDto } from '@/shared/api/openapi/types'

export type BulkMoveItemsPayload = {
  itemIds: string[]
  targetFolderId: string | null
}

export const bulkMoveItems = async ({
  itemIds,
  targetFolderId,
}: BulkMoveItemsPayload): Promise<BulkItemsResponseDto> => {
  const response = await apiClient.post<BulkItemsResponseDto>('/api/items/bulk-move', {
    item_ids: itemIds,
    target_folder_id: targetFolderId,
  })
  return response.data
}
