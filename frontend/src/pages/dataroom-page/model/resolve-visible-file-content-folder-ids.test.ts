import { describe, expect, it } from 'vitest'

import { resolveVisibleFileContentFolderIds } from './resolve-visible-file-content-folder-ids'

describe('resolveVisibleFileContentFolderIds', () => {
  it('always includes root even when it is not in manual ids', () => {
    const result = resolveVisibleFileContentFolderIds(new Set(['folder-a']), 'folder-a')

    expect(result.has('root')).toBe(true)
  })

  it('includes currently active folder for navigation consistency', () => {
    const result = resolveVisibleFileContentFolderIds(new Set(['folder-a']), 'folder-b')

    expect(result.has('folder-a')).toBe(true)
    expect(result.has('folder-b')).toBe(true)
  })

  it('normalizes active folder id to root when route value is empty', () => {
    const result = resolveVisibleFileContentFolderIds(new Set(), '')

    expect(result.has('root')).toBe(true)
    expect(result.size).toBe(1)
  })
})
