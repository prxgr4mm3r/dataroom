import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { renameItem } from '../api/rename-item'

export const useRenameItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: renameItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
