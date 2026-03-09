import { env } from '@/shared/config/env'

import { formatFileSize } from './format-file-size'

export const MAX_IMPORT_FILE_SIZE_BYTES = env.maxImportFileSizeBytes
export const MAX_IMPORT_BATCH_SIZE_BYTES = 30 * 1024 * 1024

export const isImportFileTooLarge = (file: Pick<File, 'size'>): boolean =>
  file.size > MAX_IMPORT_FILE_SIZE_BYTES

export const getImportFileTooLargeMessage = (): string =>
  `Selected file exceeds size limit (${formatFileSize(MAX_IMPORT_FILE_SIZE_BYTES)}).`

export const getImportBatchSizeBytes = (files: Array<Pick<File, 'size'>>): number =>
  files.reduce((total, file) => total + Math.max(0, Number(file.size) || 0), 0)

export const isImportBatchTooLarge = (files: Array<Pick<File, 'size'>>): boolean =>
  getImportBatchSizeBytes(files) > MAX_IMPORT_BATCH_SIZE_BYTES

export const getImportBatchTooLargeMessage = (): string =>
  `Total selected file size exceeds import limit (${formatFileSize(MAX_IMPORT_BATCH_SIZE_BYTES)} per import).`
