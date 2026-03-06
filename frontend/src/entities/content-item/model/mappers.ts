import type { ItemResourceDto } from '@/shared/api'

import type { ContentItem } from './types'

export const mapItemResourceDto = (dto: ItemResourceDto): ContentItem => ({
  id: dto.id,
  kind: dto.kind,
  name: dto.name,
  parentId: dto.parent_id,
  status: dto.status,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  mimeType: dto.mime_type ?? null,
  sizeBytes: dto.size_bytes ?? null,
  importedAt: dto.imported_at ?? null,
  origin: dto.origin ?? null,
  googleFileId: dto.google_file_id ?? null,
})
