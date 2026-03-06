import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import { getGoogleFiles } from '../api/get-google-files'

export const useGoogleFilesQuery = (enabled: boolean, query: string) =>
  useQuery({
    queryKey: queryKeys.googleFiles(query),
    queryFn: () =>
      getGoogleFiles({
        page_size: 50,
        q: query || undefined,
      }),
    enabled,
  })
