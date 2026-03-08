export const getSelectionRangeIds = (
  orderedIds: string[],
  anchorId: string | null,
  targetId: string,
): string[] => {
  if (!orderedIds.length) {
    return []
  }

  const targetIndex = orderedIds.indexOf(targetId)
  if (targetIndex < 0) {
    return []
  }

  if (!anchorId) {
    return [targetId]
  }

  const anchorIndex = orderedIds.indexOf(anchorId)
  if (anchorIndex < 0) {
    return [targetId]
  }

  const from = Math.min(anchorIndex, targetIndex)
  const to = Math.max(anchorIndex, targetIndex)
  return orderedIds.slice(from, to + 1)
}
