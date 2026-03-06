import { apiClient } from '@/shared/api'
import type { BulkItemsResponseDto } from '@/shared/api/openapi/types'

export type BulkCopyItemsPayload = {
  itemIds: string[]
  targetFolderId: string | null
}

export const bulkCopyItems = async ({
  itemIds,
  targetFolderId,
}: BulkCopyItemsPayload): Promise<BulkItemsResponseDto> => {
  const response = await apiClient.post<BulkItemsResponseDto>('/api/items/bulk-copy', {
    item_ids: itemIds,
    target_folder_id: targetFolderId,
  })
  return response.data
}
