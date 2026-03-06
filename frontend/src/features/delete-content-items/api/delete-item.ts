import { apiClient } from '@/shared/api'
import type { DeleteItemResponseDto } from '@/shared/api'

export const deleteItem = async (itemId: string): Promise<DeleteItemResponseDto> => {
  const response = await apiClient.delete<DeleteItemResponseDto>(`/api/items/${itemId}`)
  return response.data
}
