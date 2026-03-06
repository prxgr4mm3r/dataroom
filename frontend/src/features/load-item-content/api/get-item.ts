import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'

export const getItem = async (itemId: string): Promise<ItemResourceDto> => {
  const response = await apiClient.get<ItemResourceDto>(`/api/items/${itemId}`)
  return response.data
}
