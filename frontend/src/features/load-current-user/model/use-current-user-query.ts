import { useQuery } from '@tanstack/react-query'

import { mapMeDto, type UserProfile } from '@/entities/user'
import { queryKeys, toApiError } from '@/shared/api'

import { getCurrentUser } from '../api/get-current-user'

const MAX_AUTH_RECOVERY_RETRIES = 2

const shouldRetryCurrentUserQuery = (failureCount: number, error: unknown): boolean => {
  const apiError = toApiError(error)
  return apiError.status === 401 && failureCount < MAX_AUTH_RECOVERY_RETRIES
}

export const useCurrentUserQuery = (enabled: boolean) =>
  useQuery<UserProfile>({
    queryKey: queryKeys.me,
    queryFn: async () => mapMeDto(await getCurrentUser()),
    enabled,
    retry: shouldRetryCurrentUserQuery,
    retryDelay: (attemptIndex) => Math.min((attemptIndex + 1) * 1000, 3000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  })
