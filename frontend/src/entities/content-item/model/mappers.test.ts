import { describe, expect, it } from 'vitest'

import type { ItemResourceDto } from '@/shared/api'

import { mapItemResourceDto } from './mappers'

describe('mapItemResourceDto', () => {
  it('maps dto to content item', () => {
    const dto: ItemResourceDto = {
      id: 'item-1',
      kind: 'file',
      name: 'doc.pdf',
      parent_id: null,
      status: 'active',
      created_at: '2026-03-06T00:00:00Z',
      updated_at: '2026-03-06T00:00:00Z',
      mime_type: 'application/pdf',
      size_bytes: 42,
      imported_at: '2026-03-06T00:00:00Z',
      origin: 'google_drive',
      google_file_id: 'g-1',
    }

    expect(mapItemResourceDto(dto)).toEqual({
      id: 'item-1',
      kind: 'file',
      name: 'doc.pdf',
      parentId: null,
      status: 'active',
      createdAt: '2026-03-06T00:00:00Z',
      updatedAt: '2026-03-06T00:00:00Z',
      mimeType: 'application/pdf',
      sizeBytes: 42,
      importedAt: '2026-03-06T00:00:00Z',
      origin: 'google_drive',
      googleFileId: 'g-1',
    })
  })
})
