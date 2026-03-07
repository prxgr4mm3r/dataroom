import { useQueryClient } from '@tanstack/react-query'
import { useState, type DragEvent } from 'react'

import { apiClient, queryKeys, toApiError } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'
import { INTERNAL_DND_ITEMS_TYPE } from '@/shared/lib/dnd/drag-types'
import { normalizeFolderId, toNullableFolderId } from '@/shared/routes/dataroom-routes'

type DropState = 'none' | 'valid' | 'invalid'

const MAX_PARALLEL_UPLOADS = 3

export type DragImportResult = {
  uploadedCount: number
  failedCount: number
  firstErrorMessage: string | null
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
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null)

  const dragOverFolder = (folderId: string, event: DragEvent<HTMLElement>): boolean => {
    if (!isExternalFilesDrag(event)) {
      return false
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setHoveredFolderId(normalizeFolderId(folderId))
    return true
  }

  const dragLeaveFolder = (folderId: string) => {
    const normalizedFolderId = normalizeFolderId(folderId)
    if (hoveredFolderId === normalizedFolderId) {
      setHoveredFolderId(null)
    }
  }

  const dropOnFolder = async (
    folderId: string,
    event: DragEvent<HTMLElement>,
  ): Promise<DragImportResult | null> => {
    if (!isExternalFilesDrag(event)) {
      return null
    }

    event.preventDefault()
    const files = Array.from(event.dataTransfer.files ?? [])
    setHoveredFolderId(null)

    if (!files.length) {
      return {
        uploadedCount: 0,
        failedCount: 0,
        firstErrorMessage: null,
      }
    }

    const normalizedTargetFolderId = normalizeFolderId(folderId)
    const targetFolderId = toNullableFolderId(normalizedTargetFolderId)

    let cursor = 0
    let uploadedCount = 0
    let failedCount = 0
    let firstErrorMessage: string | null = null

    const worker = async () => {
      while (cursor < files.length) {
        const currentIndex = cursor
        cursor += 1
        const file = files[currentIndex]

        try {
          await uploadFile(file, targetFolderId)
          uploadedCount += 1
        } catch (error) {
          failedCount += 1
          if (!firstErrorMessage) {
            firstErrorMessage = toApiError(error).message
          }
        }
      }
    }

    const workerCount = Math.min(MAX_PARALLEL_UPLOADS, files.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    if (uploadedCount > 0) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.items })
      await queryClient.invalidateQueries({ queryKey: queryKeys.folderTree })
    }

    return {
      uploadedCount,
      failedCount,
      firstErrorMessage,
    }
  }

  const getFolderDropState = (folderId: string): DropState => {
    if (!hoveredFolderId) {
      return 'none'
    }
    return hoveredFolderId === normalizeFolderId(folderId) ? 'valid' : 'none'
  }

  return {
    isExternalFilesDrag,
    dragOverFolder,
    dragLeaveFolder,
    dropOnFolder,
    getFolderDropState,
  }
}
