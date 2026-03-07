import { apiClient } from '@/shared/api'

type RevokeShareLinkResponseDto = {
  id: string
  revoked_at: string | null
}

export const revokeShareLink = async (shareId: string): Promise<RevokeShareLinkResponseDto> => {
  const response = await apiClient.delete<RevokeShareLinkResponseDto>(`/api/shares/${shareId}`)
  return response.data
}
