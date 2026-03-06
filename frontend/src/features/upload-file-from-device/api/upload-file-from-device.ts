import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'

export type UploadFilePayload = {
  file: File
  targetFolderId: string | null
}

export const uploadFileFromDevice = async ({ file, targetFolderId }: UploadFilePayload): Promise<ItemResourceDto> => {
  const formData = new FormData()
  formData.append('file', file)
  if (targetFolderId) {
    formData.append('target_folder_id', targetFolderId)
  }

  const response = await apiClient.post<ItemResourceDto>('/api/files/upload', formData)
  return response.data
}
