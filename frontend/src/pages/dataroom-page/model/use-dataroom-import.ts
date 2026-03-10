import { useCallback, useRef, useState, type ChangeEvent } from 'react'

import {
  type DragImportFailure,
  type DragImportResult,
} from '@/features/drag-import-files'
import { useUploadFileFromDevice } from '@/features/upload-file-from-device'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import {
  getImportBatchTooLargeMessage,
  getImportFileTooLargeMessage,
  isImportBatchTooLarge,
  isImportFileTooLarge,
} from '@/shared/lib/file/import-file-size-limit'
import { toNullableFolderId } from '@/shared/routes/dataroom-routes'
import { notifyError, notifySuccess } from '@/shared/ui'

type UseDataroomImportParams = {
  normalizedFolderId: string
}

export const useDataroomImport = ({
  normalizedFolderId,
}: UseDataroomImportParams) => {
  const [importDialogOpened, setImportDialogOpened] = useState(false)
  const [dragImportResultDialog, setDragImportResultDialog] =
    useState<DragImportResult | null>(null)
  const nativeImportInputRef = useRef<HTMLInputElement>(null)

  const uploadFromComputerMutation = useUploadFileFromDevice(normalizedFolderId)

  const openGoogleImportDialog = useCallback(() => {
    setImportDialogOpened(true)
  }, [])

  const closeGoogleImportDialog = useCallback(() => {
    setImportDialogOpened(false)
  }, [])

  const openDragImportResultDialog = useCallback((result: DragImportResult) => {
    setDragImportResultDialog(result)
  }, [])

  const closeDragImportResultDialog = useCallback(() => {
    setDragImportResultDialog(null)
  }, [])

  const openComputerImportPicker = () => {
    if (uploadFromComputerMutation.isPending) {
      return
    }
    const input = nativeImportInputRef.current
    if (!input) {
      return
    }
    input.value = ''
    input.click()
  }

  const onComputerImportSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''

    if (!files.length) {
      return
    }

    const targetFolderId = toNullableFolderId(normalizedFolderId)
    const uploadedFiles: string[] = []
    const failedFiles: DragImportFailure[] = []
    const tooLargeMessage = getImportFileTooLargeMessage()
    const batchTooLargeMessage = getImportBatchTooLargeMessage()
    const importableFiles = files.filter((file) => !isImportFileTooLarge(file))

    if (importableFiles.length > 0 && isImportBatchTooLarge(importableFiles)) {
      notifyError(batchTooLargeMessage)
      return
    }

    for (const file of files) {
      if (isImportFileTooLarge(file)) {
        failedFiles.push({
          fileName: file.name,
          message: tooLargeMessage,
          reason: 'too_large',
        })
        continue
      }

      try {
        await uploadFromComputerMutation.mutateAsync({
          file,
          targetFolderId,
        })
        uploadedFiles.push(file.name)
      } catch (error) {
        const message = toApiError(error).message
        const normalizedMessage = message.toLowerCase()
        const reason: DragImportFailure['reason'] =
          normalizedMessage.includes('size limit') ||
          normalizedMessage.includes('too large') ||
          normalizedMessage.includes('exceeds')
            ? 'too_large'
            : 'upload_failed'

        failedFiles.push({
          fileName: file.name,
          message,
          reason,
        })
      }
    }

    const uploadedCount = uploadedFiles.length
    const failedCount = failedFiles.length

    if (uploadedCount > 0 && failedCount === 0) {
      notifySuccess(
        uploadedCount === 1
          ? t('fileUploadedSuccess')
          : `${uploadedCount} files uploaded successfully.`,
      )
      return
    }

    if (failedCount === 0) {
      return
    }

    const result: DragImportResult = {
      uploadedCount,
      failedCount,
      uploadedFiles,
      failedFiles,
      firstErrorMessage: failedFiles[0]?.message ?? null,
      hasPartialFailures: uploadedCount > 0 && failedCount > 0,
      allRejectedBySizeLimit:
        uploadedCount === 0 &&
        failedCount > 0 &&
        failedFiles.every((failedFile) => failedFile.reason === 'too_large'),
    }

    if (result.hasPartialFailures) {
      setDragImportResultDialog(result)
      const summary =
        failedCount === 1
          ? '1 file was not imported.'
          : `${failedCount} files were not imported.`
      notifyError(summary)
      return
    }

    const summary =
      failedCount === 1
        ? '1 file failed to upload.'
        : `${failedCount} files failed to upload.`
    notifyError(
      result.firstErrorMessage
        ? `${summary} ${result.firstErrorMessage}`
        : summary,
    )
  }

  const handleExternalDragImportResult = (result: DragImportResult) => {
    if (result.hasPartialFailures) {
      setDragImportResultDialog(result)
      const summary =
        result.failedCount === 1
          ? '1 file was not imported.'
          : `${result.failedCount} files were not imported.`
      notifyError(summary)
      return
    }

    if (result.uploadedCount > 0) {
      if (result.uploadedCount === 1) {
        notifySuccess(t('fileUploadedSuccess'))
      } else {
        notifySuccess(`${result.uploadedCount} files uploaded successfully.`)
      }
      return
    }

    if (result.failedCount > 0) {
      const summary =
        result.failedCount === 1
          ? '1 file failed to upload.'
          : `${result.failedCount} files failed to upload.`
      notifyError(
        result.firstErrorMessage
          ? `${summary} ${result.firstErrorMessage}`
          : summary,
      )
    }
  }

  return {
    importDialogOpened,
    openGoogleImportDialog,
    closeGoogleImportDialog,
    dragImportResultDialog,
    openDragImportResultDialog,
    closeDragImportResultDialog,
    nativeImportInputRef,
    importFromComputerPending: uploadFromComputerMutation.isPending,
    openComputerImportPicker,
    onComputerImportSelected,
    handleExternalDragImportResult,
  }
}
