import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'

export type CopyItemPayload = {
  itemId: string
  targetFolderId: string | null
}

export const copyItem = async ({ itemId, targetFolderId }: CopyItemPayload): Promise<ItemResourceDto> => {
  const response = await apiClient.post<ItemResourceDto>(`/api/items/${itemId}/copy`, {
    target_folder_id: targetFolderId,
  })
  return response.data
}
