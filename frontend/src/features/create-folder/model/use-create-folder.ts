import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { createFolder } from '../api/create-folder'

export const useCreateFolder = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createFolder,
    onSuccess: async () => {
      // Sidebar expansion arrows depend on `childrenCount` from parent folder listings,
      // so we need to refresh all cached folder item lists after folder creation.
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
