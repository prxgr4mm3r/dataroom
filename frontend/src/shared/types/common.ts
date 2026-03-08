export type SortBy = 'name' | 'type' | 'size' | 'imported_at' | 'updated_at'
export type SortOrder = 'asc' | 'desc'

export type ApiErrorCode =
  | 'unauthorized'
  | 'google_reconnect_required'
  | 'file_content_missing'
  | 'unsupported_item_type'
  | 'google_not_connected'
  | 'invalid_request'
  | 'target_folder_not_found'
  | string

export type Nullable<T> = T | null
