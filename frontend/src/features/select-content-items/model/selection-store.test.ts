import { beforeEach, describe, expect, it } from 'vitest'

import { useSelectionStore } from './selection-store'

describe('selection-store', () => {
  beforeEach(() => {
    useSelectionStore.setState({ selectedIds: [] })
  })

  it('toggles selected ids', () => {
    const { toggle } = useSelectionStore.getState()

    toggle('1')
    expect(useSelectionStore.getState().selectedIds).toEqual(['1'])

    toggle('1')
    expect(useSelectionStore.getState().selectedIds).toEqual([])
  })

  it('sets many unique ids', () => {
    const { setMany } = useSelectionStore.getState()
    setMany(['1', '2', '1'])

    expect(useSelectionStore.getState().selectedIds).toEqual(['1', '2'])
  })

  it('clears ids', () => {
    useSelectionStore.setState({ selectedIds: ['a'] })
    useSelectionStore.getState().clear()

    expect(useSelectionStore.getState().selectedIds).toEqual([])
  })
})
