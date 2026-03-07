import { env } from '@/shared/config/env'

import { formatFileSize } from './format-file-size'

export const MAX_IMPORT_FILE_SIZE_BYTES = env.maxImportFileSizeBytes

export const isImportFileTooLarge = (file: Pick<File, 'size'>): boolean =>
  file.size > MAX_IMPORT_FILE_SIZE_BYTES

export const getImportFileTooLargeMessage = (): string =>
  `Selected file exceeds size limit (${formatFileSize(MAX_IMPORT_FILE_SIZE_BYTES)}).`
