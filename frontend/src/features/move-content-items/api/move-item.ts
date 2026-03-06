import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'

export type MoveItemPayload = {
  itemId: string
  targetFolderId: string | null
}

export const moveItem = async ({ itemId, targetFolderId }: MoveItemPayload): Promise<ItemResourceDto> => {
  const response = await apiClient.patch<ItemResourceDto>(`/api/items/${itemId}/move`, {
    target_folder_id: targetFolderId,
  })
  return response.data
}
