import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'

export type RenameItemPayload = {
  itemId: string
  name: string
}

export const renameItem = async ({ itemId, name }: RenameItemPayload): Promise<ItemResourceDto> => {
  const response = await apiClient.patch<ItemResourceDto>(`/api/items/${itemId}/rename`, {
    name,
  })
  return response.data
}
