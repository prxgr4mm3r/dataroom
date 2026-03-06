import { describe, expect, it } from 'vitest'

import type { ContentItem } from '@/entities/content-item'
import type { FolderNode } from '@/entities/folder'

import { validateMoveTarget } from './validators'

const makeFolder = (id: string, parentId: string | null): ContentItem => ({
  id,
  kind: 'folder',
  name: id,
  parentId,
  childrenCount: 0,
  status: 'active',
  createdAt: '',
  updatedAt: '',
  mimeType: null,
  sizeBytes: null,
  importedAt: null,
  origin: null,
  googleFileId: null,
})

const tree: FolderNode = {
  id: 'root',
  name: 'Data Room',
  children: [
    {
      id: 'A',
      name: 'A',
      children: [{ id: 'B', name: 'B', children: [] }],
    },
  ],
}

describe('validateMoveTarget', () => {
  it('rejects move into itself', () => {
    const result = validateMoveTarget([makeFolder('A', 'root')], 'A', tree)
    expect(result).toEqual({ valid: false, reason: 'self' })
  })

  it('rejects move into descendant', () => {
    const result = validateMoveTarget([makeFolder('A', 'root')], 'B', tree)
    expect(result).toEqual({ valid: false, reason: 'descendant' })
  })

  it('accepts valid target', () => {
    const result = validateMoveTarget([makeFolder('A', 'root')], 'root', tree)
    expect(result).toEqual({ valid: true, reason: 'none' })
  })
})
