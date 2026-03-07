import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { revokeShareLink } from '../api/revoke-share-link'

type RevokeShareLinkPayload = {
  shareId: string
  itemId: string
}

export const useRevokeShareLink = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ shareId }: RevokeShareLinkPayload) => revokeShareLink(shareId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharesByItem(variables.itemId) })
    },
  })
}
