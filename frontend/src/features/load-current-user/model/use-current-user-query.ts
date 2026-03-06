import { useQuery } from '@tanstack/react-query'

import { mapMeDto, type UserProfile } from '@/entities/user'
import { queryKeys } from '@/shared/api'

import { getCurrentUser } from '../api/get-current-user'

export const useCurrentUserQuery = (enabled: boolean) =>
  useQuery<UserProfile>({
    queryKey: queryKeys.me,
    queryFn: async () => mapMeDto(await getCurrentUser()),
    enabled,
    retry: false,
  })
