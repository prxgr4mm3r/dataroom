import { apiClient } from '@/shared/api'

export type DownloadContentItemsPayload = {
  itemIds: string[]
  fallbackName?: string
}

export type DownloadContentItemsResult = {
  blob: Blob
  filename: string
}

const FALLBACK_NAME = 'dataroom-download.zip'

const parseFilename = (headerValue: unknown): string | null => {
  if (!headerValue || typeof headerValue !== 'string') {
    return null
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ''))
    } catch {
      return utf8Match[1].replace(/^"|"$/g, '')
    }
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i)
  return plainMatch?.[1] ?? null
}

export const downloadContentItems = async ({
  itemIds,
  fallbackName,
}: DownloadContentItemsPayload): Promise<DownloadContentItemsResult> => {
  const response = await apiClient.post<Blob>(
    '/api/items/download',
    { item_ids: itemIds },
    { responseType: 'blob' },
  )

  const filename = parseFilename(response.headers['content-disposition']) ?? fallbackName ?? FALLBACK_NAME
  return {
    blob: response.data,
    filename,
  }
}
