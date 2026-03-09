import { apiClient } from '@/shared/api'
import { resolveInlineBlob } from '@/shared/lib/file/resolve-inline-blob'

export type ItemContentPayload = {
  blob: Blob
  contentType: string
}

export const getItemContent = async (itemId: string, expectedMimeType?: string | null): Promise<ItemContentPayload> => {
  const response = await apiClient.get<Blob>(`/api/items/${itemId}/content`, {
    responseType: 'blob',
  })

  const contentType = response.headers['content-type'] || 'application/octet-stream'
  const blob = resolveInlineBlob(response.data, {
    headerContentType: contentType,
    fallbackContentType: expectedMimeType,
  })

  return {
    blob,
    contentType,
  }
}
