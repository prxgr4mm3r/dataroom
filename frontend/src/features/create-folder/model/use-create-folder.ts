import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { createFolder } from '../api/create-folder'

export const useCreateFolder = (folderId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createFolder,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.itemsPrefix(folderId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
