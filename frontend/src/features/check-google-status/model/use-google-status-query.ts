import { useQuery } from '@tanstack/react-query'

import { mapGoogleStatusDto, type GoogleConnectionStatus } from '@/entities/google-drive-connection'
import { queryKeys } from '@/shared/api'

import { getGoogleStatus } from '../api/get-google-status'

export const useGoogleStatusQuery = (enabled: boolean) =>
  useQuery<GoogleConnectionStatus>({
    queryKey: queryKeys.googleStatus,
    queryFn: async () => mapGoogleStatusDto(await getGoogleStatus()),
    enabled,
  })
