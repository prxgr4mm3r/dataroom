import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { disconnectGoogleDrive } from '../api/disconnect-google-drive'

export const useGoogleDisconnect = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disconnectGoogleDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.googleStatus })
      await queryClient.invalidateQueries({ queryKey: ['google', 'files'] })
    },
  })
}

