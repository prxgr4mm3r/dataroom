import { apiClient } from '@/shared/api'
import type { GoogleDriveFileDto, GoogleFilesParams } from '@/shared/api/openapi/types'

type GoogleFilesResponse = {
  files: GoogleDriveFileDto[]
  next_page_token: string | null
}

export const getGoogleFiles = async (params?: GoogleFilesParams): Promise<GoogleFilesResponse> => {
  const response = await apiClient.get<GoogleFilesResponse>('/api/integrations/google/files', {
    params,
  })
  return response.data
}
