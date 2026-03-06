import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { deleteItem } from '../api/delete-item'

export const useDeleteItem = (folderId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.itemsPrefix(folderId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
