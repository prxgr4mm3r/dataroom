import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { createShareLink } from '../api/create-share-link'

export const useCreateShareLink = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createShareLink,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharesByItem(result.root_item_id) })
    },
  })
}
