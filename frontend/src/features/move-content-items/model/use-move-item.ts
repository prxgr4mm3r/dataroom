import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { moveItem } from '../api/move-item'

export const useMoveItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: moveItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
