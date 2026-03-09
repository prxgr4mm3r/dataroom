type ResolveInlineBlobOptions = {
  headerContentType?: string | null
  fallbackContentType?: string | null
}

const GENERIC_BLOB_CONTENT_TYPE = 'application/octet-stream'

const normalizeContentType = (value?: string | null): string | null => {
  if (!value) {
    return null
  }

  const normalized = value.split(';', 1)[0]?.trim().toLowerCase()
  return normalized || null
}

export const resolveInlineBlob = (blob: Blob, options: ResolveInlineBlobOptions = {}): Blob => {
  const blobType = normalizeContentType(blob.type)
  const headerContentType = normalizeContentType(options.headerContentType)
  const fallbackContentType = normalizeContentType(options.fallbackContentType)

  if (blobType && blobType !== GENERIC_BLOB_CONTENT_TYPE) {
    return blob
  }

  const preferredContentType =
    headerContentType && headerContentType !== GENERIC_BLOB_CONTENT_TYPE ? headerContentType : fallbackContentType

  if (!preferredContentType || preferredContentType === blobType) {
    return blob
  }

  return new Blob([blob], { type: preferredContentType })
}
