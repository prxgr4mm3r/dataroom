import { apiClient } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'

export type ImportFromGooglePayload = {
  google_file_id: string
  target_folder_id?: string | null
}

export const importFileFromGoogle = async (
  payload: ImportFromGooglePayload,
): Promise<ItemResourceDto> => {
  const response = await apiClient.post<ItemResourceDto>('/api/files/import-from-google', payload)
  return response.data
}
