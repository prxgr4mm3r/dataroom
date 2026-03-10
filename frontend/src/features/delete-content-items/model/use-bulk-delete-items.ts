import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { bulkDeleteItems } from '../api/bulk-delete-items'

export const useBulkDeleteItems = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkDeleteItems,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.items })
      void queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
