import { describe, expect, it } from 'vitest'

import { queryKeys } from './query-keys'

describe('query keys', () => {
  it('keeps stable items root key', () => {
    expect(queryKeys.items).toEqual(['dataroom', 'items'])
  })

  it('keeps stable items prefix for invalidation', () => {
    expect(queryKeys.itemsPrefix('root')).toEqual(['dataroom', 'items', 'root'])
  })
})
