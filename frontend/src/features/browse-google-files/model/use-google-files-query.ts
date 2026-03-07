import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'

import type { GoogleFilesOrderBy, GoogleFilesSource } from '../api/get-google-files'
import { getGoogleFiles } from '../api/get-google-files'

export const useGoogleFilesQuery = (
  enabled: boolean,
  query: string,
  source: GoogleFilesSource,
  orderBy: GoogleFilesOrderBy,
) =>
  useQuery({
    queryKey: queryKeys.googleFiles(query, source, orderBy),
    queryFn: () =>
      getGoogleFiles({
        page_size: 50,
        q: query || undefined,
        source,
        order_by: orderBy,
      }),
    enabled,
  })
