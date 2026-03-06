import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { bulkDeleteItems } from '../api/bulk-delete-items'

export const useBulkDeleteItems = (folderId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: bulkDeleteItems,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.itemsPrefix(folderId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
