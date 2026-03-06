export const isInlinePreviewableMime = (mimeType: string | null | undefined): boolean => {
  if (!mimeType) {
    return false
  }

  return (
    mimeType.startsWith('text/') ||
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf'
  )
}
