import { apiClient } from '@/shared/api'
import type { FolderTreeDto } from '@/shared/api'

export const getFolderTree = async (): Promise<FolderTreeDto> => {
  const response = await apiClient.get<FolderTreeDto>('/api/folders/tree')
  return response.data
}
