import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'
import type { CreateFolderRequestDto } from '@/shared/api/openapi/types'

export const createFolder = async (payload: CreateFolderRequestDto): Promise<ItemResourceDto> => {
  const response = await apiClient.post<ItemResourceDto>('/api/folders', payload)
  return response.data
}
