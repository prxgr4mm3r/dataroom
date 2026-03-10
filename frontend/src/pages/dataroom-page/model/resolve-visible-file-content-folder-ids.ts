import { normalizeFolderId } from '@/shared/routes/dataroom-routes'

export const resolveVisibleFileContentFolderIds = (
  manualVisibleFolderIds: Set<string>,
  activeFolderId: string,
): Set<string> => {
  const next = new Set(manualVisibleFolderIds)
  next.add('root')
  next.add(normalizeFolderId(activeFolderId))
  return next
}
