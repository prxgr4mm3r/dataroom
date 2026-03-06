import { apiClient } from '@/shared/api'
import type { GoogleConnectDto } from '@/shared/api'

export const getGoogleConnectUrl = async (): Promise<GoogleConnectDto> => {
  const response = await apiClient.post<GoogleConnectDto>('/api/integrations/google/connect')
  return response.data
}
