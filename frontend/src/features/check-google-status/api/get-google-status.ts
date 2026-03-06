import { apiClient } from '@/shared/api'
import type { GoogleStatusDto } from '@/shared/api'

export const getGoogleStatus = async (): Promise<GoogleStatusDto> => {
  const response = await apiClient.get<GoogleStatusDto>('/api/integrations/google/status')
  return response.data
}
