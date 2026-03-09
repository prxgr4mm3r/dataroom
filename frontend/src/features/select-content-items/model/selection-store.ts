import { create } from 'zustand'

type SelectionState = {
  selectedIds: string[]
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  setMany: (ids: string[]) => void
  clear: () => void
}

const areArraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: [],
  isSelected: (id) => get().selectedIds.includes(id),
  toggle: (id) => {
    const selected = get().selectedIds
    set({
      selectedIds: selected.includes(id)
        ? selected.filter((current) => current !== id)
        : [...selected, id],
    })
  },
  setMany: (ids) =>
    set((state) => {
      const nextSelectedIds = [...new Set(ids)]
      if (areArraysEqual(state.selectedIds, nextSelectedIds)) {
        return state
      }
      return { selectedIds: nextSelectedIds }
    }),
  clear: () =>
    set((state) => {
      if (!state.selectedIds.length) {
        return state
      }
      return { selectedIds: [] }
    }),
}))
