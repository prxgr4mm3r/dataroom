export type ItemKind = 'folder' | 'file'
export type ItemStatus = 'active' | 'failed' | 'deleted'

export type ContentItem = {
  id: string
  kind: ItemKind
  name: string
  parentId: string | null
  childrenCount: number
  status: ItemStatus
  createdAt: string
  updatedAt: string
  mimeType: string | null
  sizeBytes: number | null
  fileCount: number | null
  importedAt: string | null
  origin: 'google_drive' | 'local_upload' | 'copied' | null
  googleFileId: string | null
}
