import { apiClient } from '@/shared/api'
import type { MeDto } from '@/shared/api'

export const getCurrentUser = async (): Promise<MeDto> => {
  const response = await apiClient.get<MeDto>('/api/me')
  return response.data
}
