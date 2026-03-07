import { apiClient } from '@/shared/api'
import type { GoogleFilesParams } from '@/shared/api/openapi/types'

export type GoogleFilesSource = 'recent' | 'my_drive' | 'shared'
export type GoogleFilesOrderBy =
  | 'modified_desc'
  | 'modified_asc'
  | 'name_asc'
  | 'name_desc'
  | 'size_desc'
  | 'size_asc'

export type GoogleDriveBrowserFile = {
  id: string
  name: string
  mime_type: string | null
  size_bytes: number | null
  modified_at: string | null
  web_view_link: string | null
  thumbnail_url: string | null
  icon_url: string | null
  shared: boolean
  owner_name: string | null
  owner_email: string | null
}

type GoogleFilesResponse = {
  files: GoogleDriveBrowserFile[]
  next_page_token: string | null
}

type GoogleFilesRequestParams = GoogleFilesParams & {
  source?: GoogleFilesSource
  order_by?: GoogleFilesOrderBy
}

export const getGoogleFiles = async (params?: GoogleFilesRequestParams): Promise<GoogleFilesResponse> => {
  const response = await apiClient.get<GoogleFilesResponse>('/api/integrations/google/files', {
    params,
  })
  return response.data
}
