import type { ContentItem } from '@/entities/content-item'
import type { FolderNode } from '@/entities/folder'

export type MoveValidationResult = {
  valid: boolean
  reason: 'none' | 'self' | 'descendant' | 'target_not_found'
}

const buildParentMap = (root: FolderNode | undefined): Map<string, string | null> => {
  const map = new Map<string, string | null>()

  const walk = (node: FolderNode, parentId: string | null) => {
    map.set(node.id, parentId)
    node.children.forEach((child) => walk(child, node.id))
  }

  if (root) {
    walk(root, null)
  }

  return map
}

const isDescendant = (candidateId: string, ancestorId: string, parentMap: Map<string, string | null>): boolean => {
  let cursor: string | null | undefined = candidateId

  while (cursor) {
    if (cursor === ancestorId) {
      return true
    }
    cursor = parentMap.get(cursor) ?? null
  }

  return false
}

export const validateMoveTarget = (
  movingItems: ContentItem[],
  targetFolderId: string,
  folderTree: FolderNode | undefined,
): MoveValidationResult => {
  const parentMap = buildParentMap(folderTree)

  if (targetFolderId !== 'root' && !parentMap.has(targetFolderId)) {
    return { valid: false, reason: 'target_not_found' }
  }

  for (const item of movingItems) {
    if (item.kind !== 'folder') {
      continue
    }

    if (item.id === targetFolderId) {
      return { valid: false, reason: 'self' }
    }

    if (targetFolderId !== 'root' && isDescendant(targetFolderId, item.id, parentMap)) {
      return { valid: false, reason: 'descendant' }
    }
  }

  return { valid: true, reason: 'none' }
}
