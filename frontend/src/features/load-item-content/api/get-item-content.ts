import { apiClient } from '@/shared/api'

export type ItemContentPayload = {
  blob: Blob
  contentType: string
}

export const getItemContent = async (itemId: string): Promise<ItemContentPayload> => {
  const response = await apiClient.get<Blob>(`/api/items/${itemId}/content`, {
    responseType: 'blob',
  })

  return {
    blob: response.data,
    contentType: response.headers['content-type'] || 'application/octet-stream',
  }
}
