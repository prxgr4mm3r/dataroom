import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { copyItem } from '../api/copy-item'

export const useCopyItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: copyItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
