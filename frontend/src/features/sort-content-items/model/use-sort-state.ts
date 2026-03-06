import { useState } from 'react'

import type { SortBy, SortOrder } from '@/shared/types/common'

export type SortState = {
  sortBy: SortBy
  sortOrder: SortOrder
}

export const useSortState = (initial?: SortState) => {
  const [state, setState] = useState<SortState>(
    initial ?? {
      sortBy: 'name',
      sortOrder: 'asc',
    },
  )

  const toggleSort = (sortBy: SortBy) => {
    setState((current) => {
      if (current.sortBy !== sortBy) {
        return { sortBy, sortOrder: 'asc' }
      }
      return {
        sortBy,
        sortOrder: current.sortOrder === 'asc' ? 'desc' : 'asc',
      }
    })
  }

  return {
    ...state,
    toggleSort,
  }
}
