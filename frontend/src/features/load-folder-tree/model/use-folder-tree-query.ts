import { useQuery } from '@tanstack/react-query'

import { mapFolderTreeDto, type FolderNode } from '@/entities/folder'
import { queryKeys } from '@/shared/api'

import { getFolderTree } from '../api/get-folder-tree'

export const useFolderTreeQuery = (enabled: boolean) =>
  useQuery<FolderNode>({
    queryKey: queryKeys.folderTree,
    queryFn: async () => mapFolderTreeDto(await getFolderTree()),
    enabled,
  })
