export const ROOT_FOLDER_ID = 'root'

export const toFolderPath = (folderId?: string | null): string => {
  if (!folderId || folderId === ROOT_FOLDER_ID) {
    return '/dataroom'
  }
  return `/dataroom/f/${encodeURIComponent(folderId)}`
}

export const normalizeFolderId = (folderId?: string | null): string => {
  if (!folderId || folderId === ROOT_FOLDER_ID) {
    return ROOT_FOLDER_ID
  }
  return folderId
}

export const toNullableFolderId = (folderId?: string | null): string | null => {
  if (!folderId || folderId === ROOT_FOLDER_ID) {
    return null
  }
  return folderId
}

export const withPreviewQuery = (previewId?: string | null): string => {
  if (!previewId) {
    return ''
  }
  return `?preview=${encodeURIComponent(previewId)}`
}
