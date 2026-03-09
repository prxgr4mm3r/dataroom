import { describe, expect, it } from 'vitest'

import {
  getIntersectedSelectionIds,
  normalizeClientRect,
  resolveDragSelectionIds,
  toOverlayRect,
} from './drag-selection'

describe('drag-selection', () => {
  it('normalizes points to a rectangle regardless of drag direction', () => {
    expect(
      normalizeClientRect(
        { x: 40, y: 120 },
        { x: 10, y: 30 },
      ),
    ).toEqual({
      left: 10,
      right: 40,
      top: 30,
      bottom: 120,
    })
  })

  it('translates a client rect to container-relative overlay coordinates', () => {
    expect(
      toOverlayRect(
        { left: 110, right: 210, top: 80, bottom: 140 },
        { left: 100, top: 50 },
      ),
    ).toEqual({
      x: 10,
      y: 30,
      width: 100,
      height: 60,
    })
  })

  it('returns ids of rows intersecting with selection area', () => {
    const selectionRect = { left: 100, right: 280, top: 100, bottom: 180 }
    const rowRects = [
      { id: 'a', rect: { left: 90, right: 300, top: 60, bottom: 98 } },
      { id: 'b', rect: { left: 90, right: 300, top: 100, bottom: 130 } },
      { id: 'c', rect: { left: 90, right: 300, top: 150, bottom: 175 } },
      { id: 'd', rect: { left: 90, right: 300, top: 200, bottom: 230 } },
    ]

    expect(getIntersectedSelectionIds(selectionRect, rowRects)).toEqual(['b', 'c'])
  })

  it('replaces selection when mode is replace', () => {
    expect(resolveDragSelectionIds('replace', ['a', 'b'], ['b', 'c', 'c'])).toEqual(['b', 'c'])
  })

  it('adds to selection when mode is add', () => {
    expect(resolveDragSelectionIds('add', ['a', 'b'], ['b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
  })
})
