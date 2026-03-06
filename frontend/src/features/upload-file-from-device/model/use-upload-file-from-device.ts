import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { uploadFileFromDevice } from '../api/upload-file-from-device'

export const useUploadFileFromDevice = (folderId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadFileFromDevice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.itemsPrefix(folderId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    },
  })
}
