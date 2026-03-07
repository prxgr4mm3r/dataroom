import { apiClient } from '@/shared/api'

type GoogleDisconnectDto = {
  connected: boolean
}

export const disconnectGoogleDrive = async (): Promise<GoogleDisconnectDto> => {
  const response = await apiClient.delete<GoogleDisconnectDto>('/api/integrations/google/disconnect')
  return response.data
}

