import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { bulkCopyItems } from '../api/bulk-copy-items'

export const useBulkCopyItems = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkCopyItems,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
