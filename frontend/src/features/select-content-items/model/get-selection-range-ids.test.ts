import { describe, expect, it } from 'vitest'

import { getSelectionRangeIds } from './get-selection-range-ids'

describe('getSelectionRangeIds', () => {
  const orderedIds = ['a', 'b', 'c', 'd', 'e']

  it('returns single target when anchor is missing', () => {
    expect(getSelectionRangeIds(orderedIds, null, 'c')).toEqual(['c'])
  })

  it('returns range from anchor to target forward', () => {
    expect(getSelectionRangeIds(orderedIds, 'b', 'd')).toEqual(['b', 'c', 'd'])
  })

  it('returns range from anchor to target backward', () => {
    expect(getSelectionRangeIds(orderedIds, 'd', 'b')).toEqual(['b', 'c', 'd'])
  })

  it('returns single target when anchor is absent in list', () => {
    expect(getSelectionRangeIds(orderedIds, 'x', 'b')).toEqual(['b'])
  })

  it('returns empty array when target is absent in list', () => {
    expect(getSelectionRangeIds(orderedIds, 'b', 'x')).toEqual([])
  })
})
