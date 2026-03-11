import type { ItemResourceDto } from '@/shared/api'

import type { ContentItem } from './types'

type ItemResourceDtoWithFileCount = ItemResourceDto & {
  file_count?: number | null
}

export const mapItemResourceDto = (dto: ItemResourceDto): ContentItem => ({
  id: dto.id,
  kind: dto.kind,
  name: dto.name,
  parentId: dto.parent_id,
  childrenCount: dto.children_count,
  status: dto.status,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
  mimeType: dto.mime_type ?? null,
  sizeBytes: dto.size_bytes ?? null,
  // `file_count` is not yet present in generated OpenAPI types on some branches.
  fileCount: (dto as ItemResourceDtoWithFileCount).file_count ?? (dto.kind === 'folder' ? dto.children_count : null),
  importedAt: dto.imported_at ?? null,
  origin: dto.origin ?? null,
  googleFileId: dto.google_file_id ?? null,
})
