import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { bulkMoveItems } from '../api/bulk-move-items'

export const useBulkMoveItems = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkMoveItems,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
