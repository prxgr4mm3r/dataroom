import { describe, expect, it } from 'vitest'

import { normalizeFolderId, toFolderPath, withPreviewQuery } from './dataroom-routes'

describe('dataroom-routes', () => {
  it('uses root path for empty/root folder ids', () => {
    expect(toFolderPath()).toBe('/dataroom')
    expect(toFolderPath('root')).toBe('/dataroom')
  })

  it('builds nested folder path', () => {
    expect(toFolderPath('folder-123')).toBe('/dataroom/f/folder-123')
  })

  it('normalizes folder ids', () => {
    expect(normalizeFolderId(undefined)).toBe('root')
    expect(normalizeFolderId('root')).toBe('root')
    expect(normalizeFolderId('abc')).toBe('abc')
  })

  it('builds preview query', () => {
    expect(withPreviewQuery('file-1')).toBe('?preview=file-1')
    expect(withPreviewQuery()).toBe('')
  })
})
