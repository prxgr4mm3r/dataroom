import { useMutation, useQueryClient } from '@tanstack/react-query'

import { importFileFromGoogle, type ImportFromGooglePayload } from '../api/import-file-from-google'

export const useImportFileFromGoogle = (folderId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ImportFromGooglePayload) => importFileFromGoogle(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataroom', 'items', folderId] })
    },
  })
}
