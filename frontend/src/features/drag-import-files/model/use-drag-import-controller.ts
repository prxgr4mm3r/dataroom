import { useQueryClient } from '@tanstack/react-query'
import { useState, type DragEvent } from 'react'

import { apiClient, queryKeys, toApiError } from '@/shared/api'
import type { ItemResourceDto } from '@/shared/api'
import { INTERNAL_DND_ITEMS_TYPE } from '@/shared/lib/dnd/drag-types'
import {
  getImportBatchTooLargeMessage,
  getImportFileTooLargeMessage,
  isImportBatchTooLarge,
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

type DroppedFileEntry = {
  file: File
  relativeFolderSegments: string[]
}

type DroppedImportPayload = {
  files: DroppedFileEntry[]
  folderPaths: string[][]
}

type LegacyFileSystemEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
}

type LegacyFileSystemFileEntry = LegacyFileSystemEntry & {
  file: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void
}

type LegacyFileSystemDirectoryReader = {
  readEntries: (
    successCallback: (entries: LegacyFileSystemEntry[]) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void
}

type LegacyFileSystemDirectoryEntry = LegacyFileSystemEntry & {
  createReader: () => LegacyFileSystemDirectoryReader
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

const splitPathSegments = (path: string): string[] =>
  path
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const normalizeFolderSegment = (value: string): string => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return 'Untitled folder'
  }
  return normalized.slice(0, 512)
}

const getSafeFileName = (file: Pick<File, 'name'>): string => {
  const segments = splitPathSegments(file.name)
  const rawBaseName = segments[segments.length - 1] ?? file.name
  const normalized = normalizeWhitespace(rawBaseName)
  if (!normalized) {
    return 'unnamed'
  }
  return normalized.slice(0, 512)
}

const getRelativeFolderSegmentsFromFile = (file: File): string[] => {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (!relativePath) {
    return []
  }

  const segments = splitPathSegments(relativePath)
  if (segments.length <= 1) {
    return []
  }

  return segments.slice(0, -1).map(normalizeFolderSegment)
}

const getDroppedDisplayName = (entry: Pick<DroppedFileEntry, 'file' | 'relativeFolderSegments'>): string => {
  const safeFileName = getSafeFileName(entry.file)
  if (entry.relativeFolderSegments.length === 0) {
    return safeFileName
  }
  return `${entry.relativeFolderSegments.join('/')}/${safeFileName}`
}

const getDataTransferItemEntry = (item: DataTransferItem): LegacyFileSystemEntry | null => {
  const withWebkitEntry = item as DataTransferItem & {
    webkitGetAsEntry?: () => LegacyFileSystemEntry | null
  }
  return withWebkitEntry.webkitGetAsEntry?.() ?? null
}

const readFileFromEntry = (entry: LegacyFileSystemFileEntry): Promise<File> =>
  new Promise((resolve, reject) => {
    entry.file(resolve, reject)
  })

const readAllDirectoryEntries = async (entry: LegacyFileSystemDirectoryEntry): Promise<LegacyFileSystemEntry[]> => {
  const reader = entry.createReader()
  const collected: LegacyFileSystemEntry[] = []

  while (true) {
    const chunk = await new Promise<LegacyFileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })

    if (!chunk.length) {
      break
    }

    collected.push(...chunk)
  }

  return collected
}

const collectDroppedPayloadFromEntry = async (
  entry: LegacyFileSystemEntry,
  parentSegments: string[],
): Promise<DroppedImportPayload> => {
  if (entry.isFile) {
    const file = await readFileFromEntry(entry as LegacyFileSystemFileEntry)
    return {
      files: [
        {
          file,
          relativeFolderSegments: parentSegments,
        },
      ],
      folderPaths: [],
    }
  }

  if (entry.isDirectory) {
    const directoryEntry = entry as LegacyFileSystemDirectoryEntry
    const directorySegments = [...parentSegments, normalizeFolderSegment(directoryEntry.name)]
    const children = await readAllDirectoryEntries(directoryEntry)

    const aggregated: DroppedImportPayload = {
      files: [],
      folderPaths: [directorySegments],
    }

    for (const child of children) {
      const childPayload = await collectDroppedPayloadFromEntry(child, directorySegments)
      aggregated.files.push(...childPayload.files)
      aggregated.folderPaths.push(...childPayload.folderPaths)
    }

    return aggregated
  }

  return {
    files: [],
    folderPaths: [],
  }
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

const getDroppedImportPayload = async (event: DragEvent<HTMLElement>): Promise<DroppedImportPayload> => {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) {
    return {
      files: [],
      folderPaths: [],
    }
  }

  const items = Array.from(dataTransfer.items ?? []).filter((item) => item.kind === 'file')
  if (!items.length) {
    return {
      files: Array.from(dataTransfer.files ?? []).map((file) => ({
        file,
        relativeFolderSegments: getRelativeFolderSegmentsFromFile(file),
      })),
      folderPaths: [],
    }
  }

  const aggregated: DroppedImportPayload = {
    files: [],
    folderPaths: [],
  }

  for (const item of items) {
    const entry = getDataTransferItemEntry(item)
    if (!entry) {
      const file = item.getAsFile()
      if (file) {
        aggregated.files.push({
          file,
          relativeFolderSegments: getRelativeFolderSegmentsFromFile(file),
        })
      }
      continue
    }

    const entryPayload = await collectDroppedPayloadFromEntry(entry, [])
    aggregated.files.push(...entryPayload.files)
    aggregated.folderPaths.push(...entryPayload.folderPaths)
  }

  if (aggregated.files.length === 0) {
    return {
      files: Array.from(dataTransfer.files ?? []).map((file) => ({
        file,
        relativeFolderSegments: getRelativeFolderSegmentsFromFile(file),
      })),
      folderPaths: aggregated.folderPaths,
    }
  }

  return aggregated
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
  formData.append('file', file, getSafeFileName(file))
  if (targetFolderId) {
    formData.append('target_folder_id', targetFolderId)
  }

  const response = await apiClient.post<ItemResourceDto>('/api/files/upload', formData)
  return response.data
}

const createFolderForImport = async (name: string, parentId: string | null): Promise<ItemResourceDto> => {
  const response = await apiClient.post<ItemResourceDto>('/api/folders', {
    name,
    parent_id: parentId,
  })
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
    let droppedPayload: DroppedImportPayload
    try {
      droppedPayload = await getDroppedImportPayload(event)
    } catch (error) {
      setHoverState(EMPTY_HOVER_STATE)
      const message = toApiError(error).message
      return {
        uploadedCount: 0,
        failedCount: 1,
        uploadedFiles: [],
        failedFiles: [
          {
            fileName: 'Dropped items',
            message,
            reason: 'upload_failed',
          },
        ],
        firstErrorMessage: message,
        hasPartialFailures: false,
        allRejectedBySizeLimit: false,
      }
    }

    setHoverState(EMPTY_HOVER_STATE)

    if (droppedPayload.files.length === 0 && droppedPayload.folderPaths.length === 0) {
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

    type IndexedFile = {
      file: File
      index: number
      relativeFolderSegments: string[]
      displayName: string
    }
    type FailureEntry = DragImportFailure & { index: number }
    type UploadedEntry = { fileName: string; index: number }

    const indexedFiles: IndexedFile[] = droppedPayload.files.map((entry, index) => ({
      file: entry.file,
      index,
      relativeFolderSegments: entry.relativeFolderSegments,
      displayName: getDroppedDisplayName(entry),
    }))

    if (indexedFiles.length === 0) {
      const message =
        'Could not read files inside the dropped folder. Try dropping files directly or use "Upload from computer".'
      return {
        uploadedCount: 0,
        failedCount: 1,
        uploadedFiles: [],
        failedFiles: [
          {
            fileName: 'Dropped folder',
            message,
            reason: 'upload_failed',
          },
        ],
        firstErrorMessage: message,
        hasPartialFailures: false,
        allRejectedBySizeLimit: false,
      }
    }
    const tooLargeMessage = getImportFileTooLargeMessage()

    const rejectedBySizeEntries: FailureEntry[] = indexedFiles
      .filter(({ file }) => isImportFileTooLarge(file))
      .map(({ displayName, index }) => ({
        fileName: displayName,
        message: tooLargeMessage,
        reason: 'too_large',
        index,
      }))

    const acceptedEntries: IndexedFile[] = indexedFiles.filter(({ file }) => !isImportFileTooLarge(file))

    if (acceptedEntries.length > 0 && isImportBatchTooLarge(acceptedEntries.map((entry) => entry.file))) {
      const batchTooLargeMessage = getImportBatchTooLargeMessage()
      const batchRejectedEntries: FailureEntry[] = acceptedEntries.map((entry) => ({
        fileName: entry.displayName,
        message: batchTooLargeMessage,
        reason: 'too_large',
        index: entry.index,
      }))
      const sortedFailedFiles = [...rejectedBySizeEntries, ...batchRejectedEntries]
        .sort((left, right) => left.index - right.index)
        .map(({ fileName, message, reason }) => ({
          fileName,
          message,
          reason,
        }))

      return {
        uploadedCount: 0,
        failedCount: sortedFailedFiles.length,
        uploadedFiles: [],
        failedFiles: sortedFailedFiles,
        firstErrorMessage: sortedFailedFiles[0]?.message ?? null,
        hasPartialFailures: false,
        allRejectedBySizeLimit: true,
      }
    }

    const normalizedTargetFolderId = normalizeFolderId(folderId)
    const targetFolderId = toNullableFolderId(normalizedTargetFolderId)
    const folderPathCache = new Map<string, Promise<string | null>>()
    folderPathCache.set('', Promise.resolve(targetFolderId))
    let hasCreatedFolders = false

    const ensureDropFolderPath = (relativeFolderSegments: string[]): Promise<string | null> => {
      let currentPath = ''
      let currentFolderPromise = folderPathCache.get('') as Promise<string | null>

      for (const segment of relativeFolderSegments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment
        const cachedPromise = folderPathCache.get(currentPath)
        if (cachedPromise) {
          currentFolderPromise = cachedPromise
          continue
        }

        const parentFolderPromise = currentFolderPromise
        const createPromise = (async () => {
          const parentFolderId = await parentFolderPromise
          const createdFolder = await createFolderForImport(segment, parentFolderId)
          hasCreatedFolders = true
          return createdFolder.id
        })()

        folderPathCache.set(currentPath, createPromise)
        currentFolderPromise = createPromise
      }

      return currentFolderPromise
    }

    const toFolderPathKey = (segments: string[]): string => segments.join('/')
    const hasDescendantFiles = (folderSegments: string[]): boolean =>
      indexedFiles.some((entry) => {
        if (entry.relativeFolderSegments.length < folderSegments.length) {
          return false
        }
        return folderSegments.every((segment, index) => entry.relativeFolderSegments[index] === segment)
      })

    const uniqueFolderPathKeys = Array.from(
      new Set(droppedPayload.folderPaths.filter((segments) => segments.length > 0).map(toFolderPathKey)),
    ).sort((left, right) => left.split('/').length - right.split('/').length)

    const emptyFolderFailures: FailureEntry[] = []

    for (const folderPathKey of uniqueFolderPathKeys) {
      const folderSegments = splitPathSegments(folderPathKey)
      try {
        await ensureDropFolderPath(folderSegments)
      } catch (error) {
        if (hasDescendantFiles(folderSegments)) {
          continue
        }
        emptyFolderFailures.push({
          fileName: folderPathKey,
          message: toApiError(error).message,
          reason: 'upload_failed',
          index: indexedFiles.length + emptyFolderFailures.length,
        })
      }
    }

    const uploadedEntries: UploadedEntry[] = []
    const failedEntries: FailureEntry[] = [...rejectedBySizeEntries, ...emptyFolderFailures]

    if (acceptedEntries.length > 0) {
      setUploadState({
        folderId: normalizedTargetFolderId,
        fileCount: acceptedEntries.length,
      })

      let cursor = 0

      const worker = async () => {
        while (cursor < acceptedEntries.length) {
          const currentIndex = cursor
          cursor += 1
          const entry = acceptedEntries[currentIndex]

          try {
            const targetDropFolderId = await ensureDropFolderPath(entry.relativeFolderSegments)
            await uploadFile(entry.file, targetDropFolderId)
            uploadedEntries.push({
              fileName: entry.displayName,
              index: entry.index,
            })
          } catch (error) {
            failedEntries.push({
              fileName: entry.displayName,
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

    const allRejectedBySizeLimit =
      sortedUploadedFiles.length === 0 &&
      sortedFailedFiles.length > 0 &&
      sortedFailedFiles.every((entry) => entry.reason === 'too_large')

    if (sortedUploadedFiles.length > 0 || hasCreatedFolders) {
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
      allRejectedBySizeLimit,
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
