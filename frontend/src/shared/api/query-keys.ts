export const queryKeys = {
  me: ['user', 'me'] as const,
  googleStatus: ['google', 'status'] as const,
  googleFiles: (query: string) => ['google', 'files', query] as const,
  folderTree: ['dataroom', 'folder-tree'] as const,
  items: ['dataroom', 'items'] as const,
  itemsPrefix: (folderId: string) => ['dataroom', 'items', folderId] as const,
  listItems: (folderId: string, sortBy: string, sortOrder: string) =>
    ['dataroom', 'items', folderId, sortBy, sortOrder] as const,
  item: (itemId: string) => ['dataroom', 'item', itemId] as const,
  itemContent: (itemId: string) => ['dataroom', 'item-content', itemId] as const,
} as const
