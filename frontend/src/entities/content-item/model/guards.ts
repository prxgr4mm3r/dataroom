import type { ContentItem } from './types'

export const isFolderItem = (item: ContentItem): boolean => item.kind === 'folder'
export const isFileItem = (item: ContentItem): boolean => item.kind === 'file'
