import { useMutation } from '@tanstack/react-query'

import { getGoogleConnectUrl } from '../api/get-google-connect-url'

export const useGoogleConnect = () =>
  useMutation({
    mutationFn: getGoogleConnectUrl,
    onSuccess: (payload) => {
      window.location.assign(payload.auth_url)
    },
  })
