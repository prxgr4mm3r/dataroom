import { useMemo, useState } from 'react'

import { normalizeFolderId } from '@/shared/routes/dataroom-routes'

type UseContentTreeBrowserParams = {
  activeFolderId: string
  expandedPathIds: string[]
}

export const useContentTreeBrowser = ({
  activeFolderId,
  expandedPathIds,
}: UseContentTreeBrowserParams) => {
  const [userExpandedIds, setUserExpandedIds] = useState<Set<string>>(() => new Set())
  const [userCollapsedIds, setUserCollapsedIds] = useState<Set<string>>(() => new Set())

  const normalizedExpandedPath = useMemo(() => {
    const normalizedActive = normalizeFolderId(activeFolderId)
    return expandedPathIds
      .map((id) => normalizeFolderId(id))
      .filter((id) => id !== 'root' && id !== normalizedActive)
  }, [activeFolderId, expandedPathIds])

  const autoExpandedIds = useMemo(() => {
    const next = new Set<string>(['root'])
    normalizedExpandedPath.forEach((id) => next.add(id))
    return next
  }, [normalizedExpandedPath])

  const expandedIds = useMemo(() => {
    const next = new Set<string>()
    autoExpandedIds.forEach((id) => {
      if (!userCollapsedIds.has(id)) {
        next.add(id)
      }
    })
    userExpandedIds.forEach((id) => {
      if (!userCollapsedIds.has(id)) {
        next.add(id)
      }
    })
    return next
  }, [autoExpandedIds, userCollapsedIds, userExpandedIds])

  const toggleExpanded = (folderId: string) => {
    const normalizedFolderId = normalizeFolderId(folderId)
    const isExpanded = expandedIds.has(normalizedFolderId)

    setUserExpandedIds((prev) => {
      const next = new Set(prev)
      if (isExpanded) {
        next.delete(normalizedFolderId)
      } else {
        next.add(normalizedFolderId)
      }
      return next
    })

    setUserCollapsedIds((prev) => {
      const next = new Set(prev)
      if (isExpanded) {
        next.add(normalizedFolderId)
      } else {
        next.delete(normalizedFolderId)
      }
      return next
    })
  }

  return {
    expandedIds,
    toggleExpanded,
    isExpanded: (folderId: string) => expandedIds.has(normalizeFolderId(folderId)),
  }
}
