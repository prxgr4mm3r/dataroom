import { create } from 'zustand'

type SelectionState = {
  selectedIds: string[]
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  setMany: (ids: string[]) => void
  clear: () => void
}

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
  setMany: (ids) => set({ selectedIds: [...new Set(ids)] }),
  clear: () => set({ selectedIds: [] }),
}))
