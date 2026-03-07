import { useQueryClient } from '@tanstack/react-query'
import { useState, type DragEvent } from 'react'

import { apiClient, queryKeys, toApiError } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'
import { INTERNAL_DND_ITEMS_TYPE } from '@/shared/lib/dnd/drag-types'
import {
  getImportFileTooLargeMessage,
  isImportFileTooLarge,
} from '@/shared/lib/file/import-file-size-limit'
import { normalizeFolderId, toNullableFolderId } from '@/shared/routes/dataroom-routes'

type DropState = 'none' | 'valid' | 'warning' | 'invalid'

type HoverState = {
  folderId: string | null
  totalFileCount: number
  acceptedFileCount: number
  rejectedFileCount: number
}

type UploadState = {
  folderId: string
  fileCount: number
}

const EMPTY_HOVER_STATE: HoverState = {
  folderId: null,
  totalFileCount: 0,
  acceptedFileCount: 0,
  rejectedFileCount: 0,
}

const MAX_PARALLEL_UPLOADS = 3

export type DragImportFailure = {
  fileName: string
  message: string
  reason: 'too_large' | 'upload_failed'
}

export type DragImportResult = {
  uploadedCount: number
  failedCount: number
  uploadedFiles: string[]
  failedFiles: DragImportFailure[]
  firstErrorMessage: string | null
  hasPartialFailures: boolean
  allRejectedBySizeLimit: boolean
}

export type DragImportOverlayState =
  | {
      mode: 'none'
    }
  | {
      mode: 'ready'
      fileCount: number
    }
  | {
      mode: 'warning'
      fileCount: number
      acceptedCount: number
      rejectedCount: number
    }
  | {
      mode: 'too_large'
      fileCount: number
    }
  | {
      mode: 'uploading'
      fileCount: number
    }

const isExternalFilesDrag = (event: DragEvent<HTMLElement>): boolean => {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return false
  }

  const types = Array.from(dataTransfer.types ?? [])
  const hasFiles = types.includes('Files')
  const isInternalDrag = types.includes(INTERNAL_DND_ITEMS_TYPE)
  return hasFiles && !isInternalDrag
}

const getDraggedFiles = (event: DragEvent<HTMLElement>): File[] => {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return []
  }

  const itemFiles = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

  if (itemFiles.length > 0) {
    return itemFiles
  }

  return Array.from(dataTransfer.files ?? [])
}

const analyzeDraggedFiles = (event: DragEvent<HTMLElement>): Omit<HoverState, 'folderId'> => {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return {
      totalFileCount: 0,
      acceptedFileCount: 0,
      rejectedFileCount: 0,
    }
  }

  const files = getDraggedFiles(event)
  const fileItemsCount = Array.from(dataTransfer.items ?? []).filter((item) => item.kind === 'file').length
  const totalFileCount = files.length > 0 ? files.length : fileItemsCount

  if (!files.length) {
    return {
      totalFileCount,
      acceptedFileCount: totalFileCount,
      rejectedFileCount: 0,
    }
  }

  const rejectedFileCount = files.filter((file) => isImportFileTooLarge(file)).length
  return {
    totalFileCount,
    acceptedFileCount: files.length - rejectedFileCount,
    rejectedFileCount,
  }
}

const uploadFile = async (file: File, targetFolderId: string | null): Promise<ItemResourceDto> => {
  const formData = new FormData()
  formData.append('file', file)
  if (targetFolderId) {
    formData.append('target_folder_id', targetFolderId)
  }

  const response = await apiClient.post<ItemResourceDto>('/api/files/upload', formData)
  return response.data
}

export const useDragImportController = () => {
  const queryClient = useQueryClient()
  const [hoverState, setHoverState] = useState<HoverState>(EMPTY_HOVER_STATE)
  const [uploadState, setUploadState] = useState<UploadState | null>(null)

  const dragOverFolder = (folderId: string, event: DragEvent<HTMLElement>): boolean => {
    if (!isExternalFilesDrag(event)) {
      return false
    }

    event.preventDefault()
    const normalizedFolderId = normalizeFolderId(folderId)
    const draggedFilesAnalysis = analyzeDraggedFiles(event)

    const allFilesRejected =
      draggedFilesAnalysis.totalFileCount > 0 &&
      draggedFilesAnalysis.acceptedFileCount === 0 &&
      draggedFilesAnalysis.rejectedFileCount > 0

    event.dataTransfer.dropEffect = allFilesRejected ? 'none' : 'copy'

    setHoverState((current) => {
      if (
        current.folderId === normalizedFolderId &&
        current.totalFileCount === draggedFilesAnalysis.totalFileCount &&
        current.acceptedFileCount === draggedFilesAnalysis.acceptedFileCount &&
        current.rejectedFileCount === draggedFilesAnalysis.rejectedFileCount
      ) {
        return current
      }

      return {
        folderId: normalizedFolderId,
        ...draggedFilesAnalysis,
      }
    })

    return true
  }

  const dragLeaveFolder = (folderId: string) => {
    const normalizedFolderId = normalizeFolderId(folderId)
    setHoverState((current) => (current.folderId === normalizedFolderId ? EMPTY_HOVER_STATE : current))
  }

  const dropOnFolder = async (
    folderId: string,
    event: DragEvent<HTMLElement>,
  ): Promise<DragImportResult | null> => {
    if (!isExternalFilesDrag(event)) {
      return null
    }

    event.preventDefault()
    const files = getDraggedFiles(event)
    setHoverState(EMPTY_HOVER_STATE)

    if (!files.length) {
      return {
        uploadedCount: 0,
        failedCount: 0,
        uploadedFiles: [],
        failedFiles: [],
        firstErrorMessage: null,
        hasPartialFailures: false,
        allRejectedBySizeLimit: false,
      }
    }

    type IndexedFile = { file: File; index: number }
    type FailureEntry = DragImportFailure & { index: number }
    type UploadedEntry = { fileName: string; index: number }

    const indexedFiles: IndexedFile[] = files.map((file, index) => ({ file, index }))
    const tooLargeMessage = getImportFileTooLargeMessage()

    const rejectedBySizeEntries: FailureEntry[] = indexedFiles
      .filter(({ file }) => isImportFileTooLarge(file))
      .map(({ file, index }) => ({
        fileName: file.name,
        message: tooLargeMessage,
        reason: 'too_large',
        index,
      }))

    const acceptedEntries: IndexedFile[] = indexedFiles.filter(({ file }) => !isImportFileTooLarge(file))

    if (!acceptedEntries.length) {
      return {
        uploadedCount: 0,
        failedCount: rejectedBySizeEntries.length,
        uploadedFiles: [],
        failedFiles: rejectedBySizeEntries.map(({ fileName, message, reason }) => ({
          fileName,
          message,
          reason,
        })),
        firstErrorMessage: rejectedBySizeEntries[0]?.message ?? null,
        hasPartialFailures: false,
        allRejectedBySizeLimit: true,
      }
    }

    const normalizedTargetFolderId = normalizeFolderId(folderId)
    const targetFolderId = toNullableFolderId(normalizedTargetFolderId)

    setUploadState({
      folderId: normalizedTargetFolderId,
      fileCount: acceptedEntries.length,
    })

    let cursor = 0
    const uploadedEntries: UploadedEntry[] = []
    const failedEntries: FailureEntry[] = [...rejectedBySizeEntries]

    const worker = async () => {
      while (cursor < acceptedEntries.length) {
        const currentIndex = cursor
        cursor += 1
        const entry = acceptedEntries[currentIndex]

        try {
          await uploadFile(entry.file, targetFolderId)
          uploadedEntries.push({
            fileName: entry.file.name,
            index: entry.index,
          })
        } catch (error) {
          failedEntries.push({
            fileName: entry.file.name,
            message: toApiError(error).message,
            reason: 'upload_failed',
            index: entry.index,
          })
        }
      }
    }

    try {
      const workerCount = Math.min(MAX_PARALLEL_UPLOADS, acceptedEntries.length)
      await Promise.all(Array.from({ length: workerCount }, () => worker()))
    } finally {
      setUploadState(null)
    }

    const sortedUploadedFiles = uploadedEntries
      .slice()
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.fileName)

    const sortedFailedFiles = failedEntries
      .slice()
      .sort((left, right) => left.index - right.index)
      .map(({ fileName, message, reason }) => ({
        fileName,
        message,
        reason,
      }))

    if (sortedUploadedFiles.length > 0) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    }

    return {
      uploadedCount: sortedUploadedFiles.length,
      failedCount: sortedFailedFiles.length,
      uploadedFiles: sortedUploadedFiles,
      failedFiles: sortedFailedFiles,
      firstErrorMessage: sortedFailedFiles[0]?.message ?? null,
      hasPartialFailures: sortedUploadedFiles.length > 0 && sortedFailedFiles.length > 0,
      allRejectedBySizeLimit: false,
    }
  }

  const getFolderDropState = (folderId: string): DropState => {
    if (!hoverState.folderId) {
      return 'none'
    }

    if (hoverState.folderId !== normalizeFolderId(folderId)) {
      return 'none'
    }

    if (hoverState.rejectedFileCount > 0 && hoverState.acceptedFileCount === 0) {
      return 'invalid'
    }

    if (hoverState.rejectedFileCount > 0) {
      return 'warning'
    }

    return 'valid'
  }

  const getFolderImportOverlayState = (folderId: string): DragImportOverlayState => {
    const normalizedFolderId = normalizeFolderId(folderId)

    if (uploadState?.folderId === normalizedFolderId) {
      return {
        mode: 'uploading',
        fileCount: uploadState.fileCount,
      }
    }

    if (hoverState.folderId !== normalizedFolderId) {
      return {
        mode: 'none',
      }
    }

    if (hoverState.rejectedFileCount > 0 && hoverState.acceptedFileCount === 0) {
      return {
        mode: 'too_large',
        fileCount: hoverState.totalFileCount,
      }
    }

    if (hoverState.rejectedFileCount > 0) {
      return {
        mode: 'warning',
        fileCount: hoverState.totalFileCount,
        acceptedCount: hoverState.acceptedFileCount,
        rejectedCount: hoverState.rejectedFileCount,
      }
    }

    return {
      mode: 'ready',
      fileCount: hoverState.totalFileCount,
    }
  }

  return {
    isExternalFilesDrag,
    dragOverFolder,
    dragLeaveFolder,
    dropOnFolder,
    getFolderDropState,
    getFolderImportOverlayState,
  }
}
