import type { FolderTreeDto, FolderTreeNodeDto } from '@/shared/api'

import type { FolderNode } from './types'

const mapNode = (node: FolderTreeNodeDto): FolderNode => ({
  id: node.id,
  name: node.name,
  children: node.children.map(mapNode),
})

export const mapFolderTreeDto = (dto: FolderTreeDto): FolderNode => mapNode(dto.root)
