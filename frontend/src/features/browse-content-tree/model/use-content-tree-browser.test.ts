import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useContentTreeBrowser } from './use-content-tree-browser'

describe('useContentTreeBrowser', () => {
  it('expands root and breadcrumb path by default', () => {
    const { result } = renderHook(() =>
      useContentTreeBrowser({
        activeFolderId: 'folder-2',
        expandedPathIds: ['root', 'folder-1', 'folder-2'],
      }),
    )

    expect(result.current.expandedIds.has('root')).toBe(true)
    expect(result.current.expandedIds.has('folder-1')).toBe(true)
    expect(result.current.expandedIds.has('folder-2')).toBe(false)
  })

  it('allows collapsing auto-expanded node and manual expand', () => {
    const { result } = renderHook(() =>
      useContentTreeBrowser({
        activeFolderId: 'folder-2',
        expandedPathIds: ['root', 'folder-1', 'folder-2'],
      }),
    )

    act(() => {
      result.current.toggleExpanded('folder-1')
    })
    expect(result.current.expandedIds.has('folder-1')).toBe(false)

    act(() => {
      result.current.toggleExpanded('folder-3')
    })
    expect(result.current.expandedIds.has('folder-3')).toBe(true)
  })

  it('can force-expand node after content appears', () => {
    const { result } = renderHook(() =>
      useContentTreeBrowser({
        activeFolderId: 'folder-2',
        expandedPathIds: ['root', 'folder-1', 'folder-2'],
      }),
    )

    expect(result.current.expandedIds.has('folder-2')).toBe(false)

    act(() => {
      result.current.expand('folder-2')
    })

    expect(result.current.expandedIds.has('folder-2')).toBe(true)
  })
})
