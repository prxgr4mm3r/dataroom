import { apiClient } from '@/shared/api'

export type GooglePickerTokenDto = {
  access_token: string
  expires_at: string | null
}

export const getGooglePickerToken = async (): Promise<GooglePickerTokenDto> => {
  const response = await apiClient.get<GooglePickerTokenDto>('/api/integrations/google/picker-token')
  return response.data
}
