import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/app/providers'
import type { ContentItem } from '@/entities/content-item'
import type { UserProfile } from '@/entities/user'
import { useContentTreeBrowser } from '@/features/browse-content-tree'
import { useBulkCopyItems, useCopyItem } from '@/features/copy-content-items'
import { useDataroomShortcuts } from '@/features/dataroom-shortcuts'
import { useBulkDeleteItems, useDeleteItem } from '@/features/delete-content-items'
import { useDownloadContentItems } from '@/features/download-content-items'
import { useDragImportController, type DragImportFailure, type DragImportResult } from '@/features/drag-import-files'
import { useDragMoveController, validateMoveTarget } from '@/features/drag-move-items'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { useBulkMoveItems, useMoveItem } from '@/features/move-content-items'
import { useOpenFilePreview } from '@/features/open-file-preview'
import { getSelectionRangeIds, useSelectionStore } from '@/features/select-content-items'
import { useSortState } from '@/features/sort-content-items'
import { useUploadFileFromDevice } from '@/features/upload-file-from-device'
import { useFolderTreeQuery } from '@/features/load-folder-tree'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import {
  getImportBatchTooLargeMessage,
  getImportFileTooLargeMessage,
  isImportBatchTooLarge,
  isImportFileTooLarge,
} from '@/shared/lib/file/import-file-size-limit'
import {
  normalizeFolderId,
  toFolderPath,
  toNullableFolderId,
  withPreviewQuery,
} from '@/shared/routes/dataroom-routes'
import { Alert, Box } from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'
import { AppShell } from '@/widgets/app-shell'
import { CreateFolderDialog } from '@/widgets/create-folder-dialog'
import { DataroomSidebar, DataroomSidebarRail } from '@/widgets/dataroom-sidebar'
import { DataroomToolbar } from '@/widgets/dataroom-toolbar'
import { DeleteItemsDialog } from '@/widgets/delete-items-dialog'
import { FileTable } from '@/widgets/file-table'
import { FolderPickerDialog } from '@/widgets/folder-picker-dialog'
import { ImportFileDialog } from '@/widgets/import-file-dialog'
import { ImportResultsDialog } from '@/widgets/import-results-dialog'
import { PreviewPane } from '@/widgets/preview-pane'
import { RenameItemDialog } from '@/widgets/rename-item-dialog'
import { SearchItemsDialog } from '@/widgets/search-items-dialog'
import { ShortcutsDialog } from '@/widgets/shortcuts-dialog'
import { ShareLinksDialog } from '@/widgets/share-links-dialog'

import './dataroom-page.css'

type DataroomPageProps = {
  currentUser: UserProfile
}

type DeleteDialogState =
  | {
      mode: 'single'
      item: ContentItem
    }
  | {
      mode: 'bulk'
    }

type TransferMode = 'copy' | 'move'

type TransferDialogState = {
  mode: TransferMode
  scope: 'single' | 'bulk'
  itemIds: string[]
  label: string
}

type DropState = 'none' | 'valid' | 'warning' | 'invalid'
const SYNTHETIC_FOLDER_TIMESTAMP = '1970-01-01T00:00:00.000Z'
const DOWNLOAD_FALLBACK_NAME = 'dataroom-download.zip'
const ZIP_EXTENSION_PATTERN = /\.zip$/i
const ROOT_FOLDER_NAME = 'Data Room'

const moveReasonMessage = (reason: ReturnType<typeof validateMoveTarget>['reason']): string | null => {
  if (reason === 'self') {
    return t('invalidMoveSelf')
  }
  if (reason === 'descendant') {
    return t('invalidMoveDescendant')
  }
  if (reason === 'same_parent') {
    return t('invalidMoveSameFolder')
  }
  if (reason === 'target_not_found') {
    return t('invalidMoveTarget')
  }
  return null
}

const resolveFallbackDownloadName = (itemIds: string[], items: ContentItem[]): string => {
  if (itemIds.length !== 1) {
    return DOWNLOAD_FALLBACK_NAME
  }

  const selectedItem = items.find((item) => item.id === itemIds[0])
  if (!selectedItem) {
    return DOWNLOAD_FALLBACK_NAME
  }

  if (selectedItem.kind === 'folder') {
    return ZIP_EXTENSION_PATTERN.test(selectedItem.name) ? selectedItem.name : `${selectedItem.name}.zip`
  }

  return selectedItem.name || DOWNLOAD_FALLBACK_NAME
}

export const DataroomPage = ({ currentUser }: DataroomPageProps) => {
  const { signOutUser } = useAuth()
  const { folderId } = useParams<{ folderId: string }>()
  const normalizedFolderId = normalizeFolderId(folderId)

  const [searchParams] = useSearchParams()
  const location = useLocation()
  const previewId = searchParams.get('preview')

  const [importDialogOpened, setImportDialogOpened] = useState(false)
  const [createFolderOpened, setCreateFolderOpened] = useState(false)
  const [createFolderParentId, setCreateFolderParentId] = useState<string>(normalizedFolderId)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [transferDialog, setTransferDialog] = useState<TransferDialogState | null>(null)
  const [shareDialogItem, setShareDialogItem] = useState<ContentItem | null>(null)
  const [renameDialogItem, setRenameDialogItem] = useState<ContentItem | null>(null)
  const [dragImportResultDialog, setDragImportResultDialog] = useState<DragImportResult | null>(null)
  const [searchDialogOpened, setSearchDialogOpened] = useState(false)
  const [shortcutsDialogOpened, setShortcutsDialogOpened] = useState(false)
  const [targetFolderId, setTargetFolderId] = useState<string>('root')
  const selectionAnchorIdRef = useRef<string | null>(null)

  const navigate = useNavigate()

  useEffect(() => {
    if (searchParams.get('import') !== 'google') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setImportDialogOpened(true)
    }, 0)

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('import')
    const nextSearch = nextSearchParams.toString()
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
    return () => window.clearTimeout(timeoutId)
  }, [location.pathname, navigate, searchParams])

  const { sortBy, sortOrder, toggleSort } = useSortState()

  const listQuery = useListContentItemsQuery(normalizedFolderId, sortBy, sortOrder)
  const folderTreeQuery = useFolderTreeQuery(true)
  const openFilePreview = useOpenFilePreview(normalizedFolderId)

  const deleteItemMutation = useDeleteItem(normalizedFolderId)
  const bulkDeleteMutation = useBulkDeleteItems(normalizedFolderId)
  const downloadItemsMutation = useDownloadContentItems()
  const copyItemMutation = useCopyItem()
  const bulkCopyMutation = useBulkCopyItems()
  const moveItemMutation = useMoveItem()
  const bulkMoveMutation = useBulkMoveItems()
  const uploadFromComputerMutation = useUploadFileFromDevice(normalizedFolderId)

  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const toggleSelected = useSelectionStore((state) => state.toggle)
  const clearSelection = useSelectionStore((state) => state.clear)
  const setSelected = useSelectionStore((state) => state.setMany)
  const clearSelectedItems = () => {
    clearSelection()
    selectionAnchorIdRef.current = null
  }

  useEffect(() => {
    clearSelection()
  }, [clearSelection, normalizedFolderId])

  const items = useMemo(() => listQuery.data?.items || [], [listQuery.data?.items])
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const breadcrumbs = useMemo(() => listQuery.data?.breadcrumbs || [], [listQuery.data?.breadcrumbs])
  const orderedItemIds = useMemo(() => items.map((item) => item.id), [items])
  const setSelectedAndSyncAnchor = (ids: string[]) => {
    const uniqueIds = [...new Set(ids)]
    setSelected(uniqueIds)
    const currentAnchorId = selectionAnchorIdRef.current
    selectionAnchorIdRef.current = currentAnchorId && uniqueIds.includes(currentAnchorId) ? currentAnchorId : uniqueIds[0] ?? null
  }

  const getSingleSelectedItem = (): ContentItem | null => {
    if (selectedIds.length !== 1) {
      return null
    }
    return itemMap.get(selectedIds[0]) ?? null
  }

  const handleToggleSelect = (itemId: string, options?: { range?: boolean; keepExisting?: boolean }) => {
    if (options?.range) {
      const rangeIds = getSelectionRangeIds(orderedItemIds, selectionAnchorIdRef.current, itemId)
      if (rangeIds.length) {
        setSelectedAndSyncAnchor(options.keepExisting ? [...selectedIds, ...rangeIds] : rangeIds)
      }
      return
    }

    toggleSelected(itemId)
    selectionAnchorIdRef.current = itemId
  }

  const selectAllVisibleItems = () => {
    const nextSelectedIds = items.map((item) => item.id)
    setSelectedAndSyncAnchor(nextSelectedIds)
  }

  const openSelectedItem = () => {
    const selectedItem = getSingleSelectedItem()
    if (!selectedItem) {
      return
    }

    if (selectedItem.kind === 'folder') {
      openFolder(selectedItem.id)
      return
    }

    openFilePreview(selectedItem.id)
  }

  const openParentFolder = () => {
    if (normalizedFolderId === 'root') {
      return
    }

    const parentFolderId = breadcrumbs[breadcrumbs.length - 2]?.id ?? 'root'
    openFolder(parentFolderId)
  }

  const openRenameForSelectedItem = () => {
    const selectedItem = getSingleSelectedItem()
    if (!selectedItem) {
      return
    }
    openSingleRenameDialog(selectedItem)
  }

  const openQuickPreviewForSelectedFile = () => {
    const selectedItem = getSingleSelectedItem()
    if (!selectedItem || selectedItem.kind !== 'file') {
      return
    }
    openFilePreview(selectedItem.id)
  }

  const hasBlockingDialog =
    importDialogOpened ||
    createFolderOpened ||
    Boolean(deleteDialog) ||
    Boolean(transferDialog) ||
    Boolean(shareDialogItem) ||
    Boolean(renameDialogItem) ||
    Boolean(dragImportResultDialog) ||
    searchDialogOpened ||
    shortcutsDialogOpened
  const getFolderActionItem = (folderId: string): ContentItem | null => {
    const existingItem = itemMap.get(folderId)
    if (existingItem) {
      return existingItem
    }

    if (folderId === 'root') {
      return null
    }

    const breadcrumbIndex = breadcrumbs.findIndex((crumb) => crumb.id === folderId)
    if (breadcrumbIndex < 0) {
      return null
    }

    const folder = breadcrumbs[breadcrumbIndex]
    const parent = breadcrumbIndex > 0 ? breadcrumbs[breadcrumbIndex - 1] : null

    return {
      id: folder.id,
      kind: 'folder',
      name: folder.name,
      parentId: parent && parent.id !== 'root' ? parent.id : null,
      childrenCount: 0,
      status: 'active',
      createdAt: SYNTHETIC_FOLDER_TIMESTAMP,
      updatedAt: SYNTHETIC_FOLDER_TIMESTAMP,
      mimeType: null,
      sizeBytes: null,
      importedAt: null,
      origin: null,
      googleFileId: null,
    }
  }
  const expandedPathIds = useMemo(() => breadcrumbs.map((crumb) => crumb.id), [breadcrumbs])
  const treeBrowser = useContentTreeBrowser({
    activeFolderId: normalizedFolderId,
    expandedPathIds,
  })
  const expandTreeFolder = treeBrowser.expand
  const autoExpandedFolderIdRef = useRef<string | null>(null)
  const previousItemsCountRef = useRef<number | null>(null)
  const nativeImportInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const hasData = Boolean(listQuery.data)
    if (!hasData) {
      return
    }
    if (autoExpandedFolderIdRef.current === normalizedFolderId) {
      return
    }

    const pathIds = (listQuery.data?.breadcrumbs ?? []).map((crumb) => crumb.id)
    pathIds.forEach((folderIdFromPath) => {
      expandTreeFolder(folderIdFromPath)
    })
    expandTreeFolder(normalizedFolderId)
    autoExpandedFolderIdRef.current = normalizedFolderId
  }, [listQuery.data, normalizedFolderId, expandTreeFolder])

  useEffect(() => {
    previousItemsCountRef.current = null
  }, [normalizedFolderId])

  useEffect(() => {
    const nextCount = listQuery.data?.items.length
    if (typeof nextCount !== 'number') {
      return
    }

    const previousCount = previousItemsCountRef.current
    if (typeof previousCount === 'number' && nextCount > previousCount) {
      expandTreeFolder(normalizedFolderId)
    }

    previousItemsCountRef.current = nextCount
  }, [listQuery.data?.items.length, normalizedFolderId, expandTreeFolder])

  const openFolder = (id: string) => {
    navigate(toFolderPath(id))
  }

  const openFileFromSearch = (fileId: string, parentFolderId: string | null) => {
    navigate(`${toFolderPath(parentFolderId)}${withPreviewQuery(fileId)}`)
  }

  const openGoogleImportDialog = () => {
    setImportDialogOpened(true)
  }

  const openCreateFolderDialog = (folderId: string = normalizedFolderId) => {
    setCreateFolderParentId(normalizeFolderId(folderId))
    setCreateFolderOpened(true)
  }

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
      notifySuccess(uploadedCount === 1 ? t('fileUploadedSuccess') : `${uploadedCount} files uploaded successfully.`)
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
        uploadedCount === 0 && failedCount > 0 && failedFiles.every((failedFile) => failedFile.reason === 'too_large'),
    }

    if (result.hasPartialFailures) {
      setDragImportResultDialog(result)
      const summary = failedCount === 1 ? '1 file was not imported.' : `${failedCount} files were not imported.`
      notifyError(summary)
      return
    }

    const summary = failedCount === 1 ? '1 file failed to upload.' : `${failedCount} files failed to upload.`
    notifyError(result.firstErrorMessage ? `${summary} ${result.firstErrorMessage}` : summary)
  }

  const openFileFromSidebar = (fileId: string, parentFolderId: string) => {
    navigate(`${toFolderPath(parentFolderId)}${withPreviewQuery(fileId)}`)
  }

  const closePreviewIfMoved = (movedIds: string[], destinationFolderId: string) => {
    if (!previewId || !movedIds.includes(previewId)) {
      return
    }

    const normalizedDestination = normalizeFolderId(destinationFolderId)
    if (normalizedDestination !== normalizedFolderId) {
      navigate(toFolderPath(normalizedFolderId), { replace: true })
    }
  }

  const getMovingItems = (itemIds: string[]): ContentItem[] =>
    itemIds.map((id) => getFolderActionItem(id)).filter((item): item is ContentItem => Boolean(item))

  const getTargetError = (mode: TransferMode, itemIds: string[], folderIdCandidate: string): string | null => {
    const normalizedTarget = normalizeFolderId(folderIdCandidate)
    const transferItems = getMovingItems(itemIds)

    if (mode === 'copy') {
      const validation = validateMoveTarget(transferItems, normalizedTarget, folderTreeQuery.data)
      if (validation.reason === 'none' || validation.reason === 'same_parent') {
        return null
      }
      return moveReasonMessage(validation.reason)
    }

    const validation = validateMoveTarget(transferItems, normalizedTarget, folderTreeQuery.data)
    return moveReasonMessage(validation.reason)
  }

  const resolveInitialTransferTarget = (
    mode: TransferMode,
    itemIds: string[],
    preferredFolderId: string,
  ): string => {
    const preferred = normalizeFolderId(preferredFolderId)
    if (!getTargetError(mode, itemIds, preferred)) {
      return preferred
    }

    const folderTree = folderTreeQuery.data
    if (!folderTree) {
      return preferred
    }

    const stack: Array<typeof folderTree> = [folderTree]
    while (stack.length) {
      const node = stack.pop()
      if (!node) {
        continue
      }
      if (!getTargetError(mode, itemIds, node.id)) {
        return node.id
      }
      for (let idx = node.children.length - 1; idx >= 0; idx -= 1) {
        stack.push(node.children[idx])
      }
    }

    return preferred
  }

  const resetTransferMutations = () => {
    copyItemMutation.reset()
    bulkCopyMutation.reset()
    moveItemMutation.reset()
    bulkMoveMutation.reset()
  }

  const openTransferDialog = (
    mode: TransferMode,
    scope: 'single' | 'bulk',
    itemIds: string[],
    label: string,
  ) => {
    resetTransferMutations()
    setTargetFolderId(resolveInitialTransferTarget(mode, itemIds, normalizedFolderId))
    setTransferDialog({ mode, scope, itemIds, label })
  }

  const openSingleCopyDialog = (item: ContentItem) => {
    openTransferDialog('copy', 'single', [item.id], item.name)
  }

  const openSingleMoveDialog = (item: ContentItem) => {
    openTransferDialog('move', 'single', [item.id], item.name)
  }

  const openBulkCopyDialog = () => {
    if (!selectedIds.length) {
      return
    }
    openTransferDialog('copy', 'bulk', selectedIds, `${selectedIds.length} selected item(s)`)
  }

  const openBulkMoveDialog = () => {
    if (!selectedIds.length) {
      return
    }
    openTransferDialog('move', 'bulk', selectedIds, `${selectedIds.length} selected item(s)`)
  }

  const closeTransferDialog = () => {
    setTransferDialog(null)
    resetTransferMutations()
  }

  const transferPending = (() => {
    if (!transferDialog) {
      return false
    }
    if (transferDialog.mode === 'copy' && transferDialog.scope === 'single') {
      return copyItemMutation.isPending
    }
    if (transferDialog.mode === 'copy' && transferDialog.scope === 'bulk') {
      return bulkCopyMutation.isPending
    }
    if (transferDialog.mode === 'move' && transferDialog.scope === 'single') {
      return moveItemMutation.isPending
    }
    return bulkMoveMutation.isPending
  })()

  const transferError = (() => {
    if (!transferDialog) {
      return null
    }
    if (transferDialog.mode === 'copy' && transferDialog.scope === 'single' && copyItemMutation.error) {
      return toApiError(copyItemMutation.error).message
    }
    if (transferDialog.mode === 'copy' && transferDialog.scope === 'bulk' && bulkCopyMutation.error) {
      return toApiError(bulkCopyMutation.error).message
    }
    if (transferDialog.mode === 'move' && transferDialog.scope === 'single' && moveItemMutation.error) {
      return toApiError(moveItemMutation.error).message
    }
    if (transferDialog.mode === 'move' && transferDialog.scope === 'bulk' && bulkMoveMutation.error) {
      return toApiError(bulkMoveMutation.error).message
    }
    return null
  })()

  const onConfirmTransfer = async () => {
    if (!transferDialog) {
      return
    }

    const targetError = getTargetError(transferDialog.mode, transferDialog.itemIds, targetFolderId)
    if (targetError) {
      return
    }

    const targetFolderNullable = toNullableFolderId(targetFolderId)

    try {
      if (transferDialog.mode === 'copy') {
        if (transferDialog.scope === 'single') {
          await copyItemMutation.mutateAsync({
            itemId: transferDialog.itemIds[0],
            targetFolderId: targetFolderNullable,
          })
          notifySuccess(t('copyItemSuccess'))
        } else {
          await bulkCopyMutation.mutateAsync({
            itemIds: transferDialog.itemIds,
            targetFolderId: targetFolderNullable,
          })
          notifySuccess(t('copyItemsSuccess'))
        }
      } else if (transferDialog.scope === 'single') {
        await moveItemMutation.mutateAsync({
          itemId: transferDialog.itemIds[0],
          targetFolderId: targetFolderNullable,
        })
        closePreviewIfMoved(transferDialog.itemIds, targetFolderId)
        setSelectedAndSyncAnchor(selectedIds.filter((id) => !transferDialog.itemIds.includes(id)))
        notifySuccess(t('moveItemSuccess'))
      } else {
        await bulkMoveMutation.mutateAsync({
          itemIds: transferDialog.itemIds,
          targetFolderId: targetFolderNullable,
        })
        closePreviewIfMoved(transferDialog.itemIds, targetFolderId)
        setSelectedAndSyncAnchor(selectedIds.filter((id) => !transferDialog.itemIds.includes(id)))
        notifySuccess(t('moveItemsSuccess'))
      }

      closeTransferDialog()
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

  const dragMoveController = useDragMoveController({
    items,
    selectedIds,
    folderTree: folderTreeQuery.data,
    onInvalidDrop: (message) => notifyError(message),
    onMoveItems: async (itemIds, destinationFolderId) => {
      const targetFolderNullable = toNullableFolderId(destinationFolderId)

      try {
        if (itemIds.length === 1) {
          await moveItemMutation.mutateAsync({
            itemId: itemIds[0],
            targetFolderId: targetFolderNullable,
          })
          notifySuccess(t('moveItemSuccess'))
        } else {
          await bulkMoveMutation.mutateAsync({
            itemIds,
            targetFolderId: targetFolderNullable,
          })
          notifySuccess(t('moveItemsSuccess'))
        }

        closePreviewIfMoved(itemIds, destinationFolderId)
        setSelectedAndSyncAnchor(selectedIds.filter((id) => !itemIds.includes(id)))
      } catch (error) {
        notifyError(toApiError(error).message)
      }
    },
  })
  const dragImportController = useDragImportController()

  const handleFolderDragOver = (folderId: string, event: DragEvent<HTMLElement>) => {
    const handledByImport = dragImportController.dragOverFolder(folderId, event)
    if (handledByImport) {
      return
    }
    dragMoveController.dragOverFolder(folderId, event)
  }

  const handleFolderDragLeave = (folderId: string) => {
    dragImportController.dragLeaveFolder(folderId)
    dragMoveController.dragLeaveFolder(folderId)
  }

  const handleFolderDrop = async (folderId: string, event: DragEvent<HTMLElement>) => {
    if (dragImportController.isExternalFilesDrag(event)) {
      const result = await dragImportController.dropOnFolder(folderId, event)
      if (result) {
        if (result.hasPartialFailures) {
          setDragImportResultDialog(result)
          const summary =
            result.failedCount === 1
              ? '1 file was not imported.'
              : `${result.failedCount} files were not imported.`
          notifyError(summary)
        } else if (result.uploadedCount > 0) {
          if (result.uploadedCount === 1) {
            notifySuccess(t('fileUploadedSuccess'))
          } else {
            notifySuccess(`${result.uploadedCount} files uploaded successfully.`)
          }
        } else if (result.failedCount > 0) {
          const summary =
            result.failedCount === 1
              ? '1 file failed to upload.'
              : `${result.failedCount} files failed to upload.`
          notifyError(result.firstErrorMessage ? `${summary} ${result.firstErrorMessage}` : summary)
        }
      }
      return
    }

    await dragMoveController.dropOnFolder(folderId, event)
  }

  const getFolderDropState = (folderId: string): DropState => {
    const importDropState = dragImportController.getFolderDropState(folderId)
    if (importDropState !== 'none') {
      return importDropState
    }
    return dragMoveController.getFolderDropState(folderId)
  }
  const currentFolderImportOverlayState = dragImportController.getFolderImportOverlayState(normalizedFolderId)
  const currentFolderMoveOverlayCount = dragMoveController.dragPayload?.itemIds.length ?? 0

  const openSingleDeleteDialog = (item: ContentItem) => {
    deleteItemMutation.reset()
    bulkDeleteMutation.reset()
    setDeleteDialog({ mode: 'single', item })
  }

  const openSingleShareDialog = (item: ContentItem) => {
    setShareDialogItem(item)
  }

  const openSingleRenameDialog = (item: ContentItem) => {
    setRenameDialogItem(item)
  }

  const openCurrentFolderCopyDialog = (folderId: string) => {
    const folderItem = getFolderActionItem(folderId)
    if (!folderItem || folderItem.kind !== 'folder') {
      return
    }
    openSingleCopyDialog(folderItem)
  }

  const openCurrentFolderMoveDialog = (folderId: string) => {
    const folderItem = getFolderActionItem(folderId)
    if (!folderItem || folderItem.kind !== 'folder') {
      return
    }
    openSingleMoveDialog(folderItem)
  }

  const openCurrentFolderDeleteDialog = (folderId: string) => {
    const folderItem = getFolderActionItem(folderId)
    if (!folderItem || folderItem.kind !== 'folder') {
      return
    }
    openSingleDeleteDialog(folderItem)
  }

  const openCurrentFolderShareDialog = (folderId: string) => {
    const folderItem = getFolderActionItem(folderId)
    if (!folderItem || folderItem.kind !== 'folder') {
      return
    }
    openSingleShareDialog(folderItem)
  }

  const openCurrentFolderRenameDialog = (folderId: string) => {
    const folderItem = getFolderActionItem(folderId)
    if (!folderItem || folderItem.kind !== 'folder') {
      return
    }
    openSingleRenameDialog(folderItem)
  }

  const downloadCurrentFolder = (folderId: string) => {
    const folderItem = getFolderActionItem(folderId)
    if (!folderItem || folderItem.kind !== 'folder') {
      return
    }
    downloadSingleItem(folderItem)
  }

  const openRootShareDialog = () => {
    const rootName = (breadcrumbs[0]?.name || ROOT_FOLDER_NAME).trim() || ROOT_FOLDER_NAME
    const nowIso = new Date().toISOString()
    setShareDialogItem({
      id: 'root',
      kind: 'folder',
      name: rootName,
      parentId: null,
      childrenCount: items.length,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
      mimeType: null,
      sizeBytes: items.reduce((total, item) => total + Number(item.sizeBytes || 0), 0),
      importedAt: null,
      origin: null,
      googleFileId: null,
    })
  }

  const downloadRootFolder = () => {
    if (!items.length) {
      notifyError('There are no items in Data Room to download.')
      return
    }

    const rootName = (breadcrumbs[0]?.name || ROOT_FOLDER_NAME).trim() || ROOT_FOLDER_NAME
    const fallbackName = ZIP_EXTENSION_PATTERN.test(rootName) ? rootName : `${rootName}.zip`
    void downloadItems(
      items.map((item) => item.id),
      fallbackName,
    )
  }

  const openBulkDeleteDialog = () => {
    if (!selectedIds.length) {
      return
    }
    deleteItemMutation.reset()
    bulkDeleteMutation.reset()
    setDeleteDialog({ mode: 'bulk' })
  }

  const downloadItems = async (itemIds: string[], fallbackName?: string) => {
    try {
      await downloadItemsMutation.mutateAsync({ itemIds, fallbackName })
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

  const downloadSingleItem = (item: ContentItem) => {
    const fallbackName =
      item.kind === 'folder'
        ? ZIP_EXTENSION_PATTERN.test(item.name)
          ? item.name
          : `${item.name}.zip`
        : item.name || DOWNLOAD_FALLBACK_NAME
    void downloadItems([item.id], fallbackName)
  }

  const downloadSelectedItems = () => {
    if (!selectedIds.length) {
      return
    }
    const fallbackName = resolveFallbackDownloadName(selectedIds, items)
    void downloadItems(selectedIds, fallbackName)
  }

  const deletePending =
    deleteDialog?.mode === 'bulk' ? bulkDeleteMutation.isPending : deleteItemMutation.isPending

  const deleteError = (() => {
    if (!deleteDialog) {
      return null
    }
    if (deleteDialog.mode === 'bulk' && bulkDeleteMutation.error) {
      return toApiError(bulkDeleteMutation.error).message
    }
    if (deleteDialog.mode === 'single' && deleteItemMutation.error) {
      return toApiError(deleteItemMutation.error).message
    }
    return null
  })()

  const onConfirmDelete = async () => {
    if (!deleteDialog) {
      return
    }

    try {
      const navigationTargetFolderIdAfterDelete = (() => {
        if (deleteDialog.mode !== 'single' || deleteDialog.item.kind !== 'folder') {
          return null
        }

        const deletedFolderId = deleteDialog.item.id
        const deletedFolderParentId = normalizeFolderId(deleteDialog.item.parentId ?? 'root')

        if (deletedFolderId === normalizedFolderId) {
          return deletedFolderParentId
        }

        const deletedFolderPathIndex = breadcrumbs.findIndex((crumb) => crumb.id === deletedFolderId)
        const isDeletedFolderInCurrentPath = deletedFolderPathIndex >= 0
        const isDeletedFolderAncestorOfCurrent = deletedFolderPathIndex >= 0 && deletedFolderPathIndex < breadcrumbs.length - 1

        if (!isDeletedFolderInCurrentPath || !isDeletedFolderAncestorOfCurrent) {
          return null
        }

        if (deletedFolderPathIndex <= 0) {
          return 'root'
        }

        return normalizeFolderId(breadcrumbs[deletedFolderPathIndex - 1]?.id ?? deletedFolderParentId)
      })()

      if (deleteDialog.mode === 'single') {
        await deleteItemMutation.mutateAsync(deleteDialog.item.id)
        closePreviewIfMoved([deleteDialog.item.id], normalizedFolderId)
        setSelectedAndSyncAnchor(selectedIds.filter((id) => id !== deleteDialog.item.id))
      } else {
        await bulkDeleteMutation.mutateAsync(selectedIds)
        closePreviewIfMoved(selectedIds, normalizedFolderId)
        clearSelectedItems()
      }

      setDeleteDialog(null)

      if (navigationTargetFolderIdAfterDelete) {
        navigate(toFolderPath(navigationTargetFolderIdAfterDelete), { replace: true })
      }

      notifySuccess(deleteDialog.mode === 'single' ? t('deleteItemSuccess') : t('deleteItemsSuccess'))
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

  const deleteDialogTitle =
    deleteDialog?.mode === 'single' ? t('deleteItemTitle') : t('deleteItemsTitle')

  const deleteDialogMessage =
    deleteDialog?.mode === 'single'
      ? `Delete "${deleteDialog.item.name}"? This action cannot be undone.`
      : `Delete ${selectedIds.length} selected item(s)? This action cannot be undone.`

  const transferDialogTitle = (() => {
    if (!transferDialog) {
      return ''
    }
    if (transferDialog.mode === 'copy' && transferDialog.scope === 'single') {
      return t('copyItemTitle')
    }
    if (transferDialog.mode === 'copy' && transferDialog.scope === 'bulk') {
      return t('copyItemsTitle')
    }
    if (transferDialog.mode === 'move' && transferDialog.scope === 'single') {
      return t('moveItemTitle')
    }
    return t('moveItemsTitle')
  })()

  const transferConfirmLabel = transferDialog?.mode === 'copy' ? t('copyConfirm') : t('moveConfirm')

  useDataroomShortcuts({
    suspended: hasBlockingDialog,
    onOpenSearch: () => setSearchDialogOpened(true),
    onCreateFolder: () => openCreateFolderDialog(normalizedFolderId),
    onImportFromComputer: openComputerImportPicker,
    onImportFromGoogle: openGoogleImportDialog,
    onSelectAll: selectAllVisibleItems,
    onOpenSelected: openSelectedItem,
    onOpenParentFolder: openParentFolder,
    onDeleteSelected: openBulkDeleteDialog,
    onRenameSelected: openRenameForSelectedItem,
    onQuickPreview: openQuickPreviewForSelectedFile,
    onEscape: () => {
      if (hasBlockingDialog) {
        return
      }
      if (!selectedIds.length) {
        return
      }
      clearSelectedItems()
    },
    onOpenShortcutsHelp: () => setShortcutsDialogOpened(true),
  })

  return (
    <>
      <AppShell
        sidebar={
          <DataroomSidebar
            currentUser={currentUser}
            activeFolderId={normalizedFolderId}
            activePreviewId={previewId}
            expandedIds={treeBrowser.expandedIds}
            onNewFolder={() => openCreateFolderDialog(normalizedFolderId)}
            onImportFromGoogle={openGoogleImportDialog}
            onImportFromComputer={openComputerImportPicker}
            onToggleExpanded={treeBrowser.toggleExpanded}
            onOpenFolder={openFolder}
            onOpenFile={openFileFromSidebar}
            onSignOut={() => void signOutUser()}
            onDownloadItem={downloadSingleItem}
            onCopyItem={openSingleCopyDialog}
            onRenameItem={openSingleRenameDialog}
            onMoveItem={openSingleMoveDialog}
            onDeleteItem={openSingleDeleteDialog}
            onShareItem={openSingleShareDialog}
            onRootCreateFolder={() => openCreateFolderDialog('root')}
            onRootDownload={downloadRootFolder}
            onRootShare={openRootShareDialog}
            onDragStartItem={dragMoveController.startDragFromTree}
            onDragEnd={dragMoveController.endDrag}
            onFolderDragOver={handleFolderDragOver}
            onFolderDrop={(folderId, event) => {
              void handleFolderDrop(folderId, event)
            }}
            onFolderDragLeave={handleFolderDragLeave}
            getFolderDropState={getFolderDropState}
            isDraggingItem={dragMoveController.isDraggingItem}
          />
        }
        collapsedSidebar={
          <DataroomSidebarRail
            currentUser={currentUser}
            onNewFolder={() => openCreateFolderDialog(normalizedFolderId)}
            onImportFromGoogle={openGoogleImportDialog}
            onImportFromComputer={openComputerImportPicker}
            onSignOut={() => void signOutUser()}
          />
        }
        header={
          <DataroomToolbar
            breadcrumbs={breadcrumbs}
            onNavigate={openFolder}
            onOpenSearch={() => setSearchDialogOpened(true)}
            currentFolderMenu={
              {
                onCreateFolder: (folder) => openCreateFolderDialog(folder.id),
                onDownload: (folder) => {
                  if (folder.id === 'root') {
                    downloadRootFolder()
                    return
                  }
                  downloadCurrentFolder(folder.id)
                },
                onCopy: (folder) => {
                  if (folder.id === 'root') {
                    return
                  }
                  openCurrentFolderCopyDialog(folder.id)
                },
                onShare: (folder) => {
                  if (folder.id === 'root') {
                    openRootShareDialog()
                    return
                  }
                  openCurrentFolderShareDialog(folder.id)
                },
                onRename: (folder) => {
                  if (folder.id === 'root') {
                    return
                  }
                  openCurrentFolderRenameDialog(folder.id)
                },
                onMove: (folder) => {
                  if (folder.id === 'root') {
                    return
                  }
                  openCurrentFolderMoveDialog(folder.id)
                },
                onDelete: (folder) => {
                  if (folder.id === 'root') {
                    return
                  }
                  openCurrentFolderDeleteDialog(folder.id)
                },
              }
            }
            onFolderDragOver={handleFolderDragOver}
            onFolderDragLeave={handleFolderDragLeave}
            onFolderDrop={(folderId, event) => {
              void handleFolderDrop(folderId, event)
            }}
            getFolderDropState={getFolderDropState}
          />
        }
        content={
          <div className="dataroom-page__content">
            <Box className="dataroom-page__table">
              {listQuery.error ? (
                <Alert color="red" m="md" title="Failed to load items">
                  {toApiError(listQuery.error).message}
                </Alert>
              ) : (
                <FileTable
                  items={items}
                  loading={listQuery.isPending && !listQuery.data}
                  currentFolderId={normalizedFolderId}
                  openedPreviewId={previewId}
                  selectedIds={selectedIds}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onToggleSort={toggleSort}
                  onToggleSelect={handleToggleSelect}
                  onSetSelection={setSelectedAndSyncAnchor}
                  onToggleSelectAll={(checked) => {
                    if (!checked) {
                      clearSelectedItems()
                      return
                    }
                    selectAllVisibleItems()
                  }}
                  onOpenFile={openFilePreview}
                  onOpenFolder={openFolder}
                  onDownloadItem={downloadSingleItem}
                  onImportFromGoogle={openGoogleImportDialog}
                  onImportFromComputer={openComputerImportPicker}
                  importFromComputerPending={uploadFromComputerMutation.isPending}
                  onCopyItem={openSingleCopyDialog}
                  onRenameItem={openSingleRenameDialog}
                  onMoveItem={openSingleMoveDialog}
                  onDeleteItem={openSingleDeleteDialog}
                  onShareItem={openSingleShareDialog}
                  onClearSelection={clearSelectedItems}
                  onDownloadSelected={downloadSelectedItems}
                  onCopySelected={openBulkCopyDialog}
                  onMoveSelected={openBulkMoveDialog}
                  onDeleteSelected={openBulkDeleteDialog}
                  downloadPending={downloadItemsMutation.isPending}
                  copyPending={Boolean(
                    transferDialog?.mode === 'copy' && transferDialog.scope === 'bulk' && transferPending,
                  )}
                  movePending={Boolean(
                    transferDialog?.mode === 'move' && transferDialog.scope === 'bulk' && transferPending,
                  )}
                  deletePending={deleteDialog?.mode === 'bulk' && bulkDeleteMutation.isPending}
                  onDragStartItem={dragMoveController.startDragFromTable}
                  onDragEnd={dragMoveController.endDrag}
                  onFolderDragOver={handleFolderDragOver}
                  onFolderDragLeave={handleFolderDragLeave}
                  onFolderDrop={(folderId, event) => {
                    void handleFolderDrop(folderId, event)
                  }}
                  getFolderDropState={getFolderDropState}
                  importOverlayState={currentFolderImportOverlayState}
                  moveOverlayItemCount={currentFolderMoveOverlayCount}
                  isDraggingItem={dragMoveController.isDraggingItem}
                />
              )}
            </Box>
            <PreviewPane folderId={normalizedFolderId} previewItemId={previewId} />
          </div>
        }
      />

      <input
        ref={nativeImportInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          void onComputerImportSelected(event)
        }}
      />

      <ImportFileDialog
        opened={importDialogOpened}
        folderId={normalizedFolderId}
        onClose={() => setImportDialogOpened(false)}
        onPartialImportResult={(result) => {
          setDragImportResultDialog(result)
        }}
      />

      <CreateFolderDialog
        opened={createFolderOpened}
        folderId={createFolderParentId}
        onClose={() => setCreateFolderOpened(false)}
      />

      <DeleteItemsDialog
        opened={Boolean(deleteDialog)}
        title={deleteDialogTitle}
        message={deleteDialogMessage}
        pending={deletePending}
        error={deleteError}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => void onConfirmDelete()}
      />

      <FolderPickerDialog
        opened={Boolean(transferDialog)}
        title={transferDialogTitle}
        description={transferDialog ? transferDialog.label : ''}
        confirmLabel={transferConfirmLabel}
        pending={transferPending}
        targetFolderId={targetFolderId}
        folderTree={folderTreeQuery.data}
        error={transferError}
        getTargetError={(folderIdCandidate) => {
          if (!transferDialog) {
            return null
          }
          return getTargetError(transferDialog.mode, transferDialog.itemIds, folderIdCandidate)
        }}
        onSelectFolder={setTargetFolderId}
        onConfirm={() => void onConfirmTransfer()}
        onClose={closeTransferDialog}
      />

      <ImportResultsDialog
        opened={Boolean(dragImportResultDialog)}
        uploadedFiles={dragImportResultDialog?.uploadedFiles ?? []}
        failedFiles={dragImportResultDialog?.failedFiles ?? []}
        onClose={() => setDragImportResultDialog(null)}
      />

      <ShareLinksDialog
        opened={Boolean(shareDialogItem)}
        item={shareDialogItem}
        onClose={() => setShareDialogItem(null)}
      />

      <RenameItemDialog
        opened={Boolean(renameDialogItem)}
        item={renameDialogItem}
        onClose={() => setRenameDialogItem(null)}
      />

      <SearchItemsDialog
        opened={searchDialogOpened}
        mode="dataroom"
        currentFolderId={normalizedFolderId}
        onClose={() => setSearchDialogOpened(false)}
        onOpenFolder={openFolder}
        onOpenFile={openFileFromSearch}
      />

      <ShortcutsDialog opened={shortcutsDialogOpened} onClose={() => setShortcutsDialogOpened(false)} />
    </>
  )
}
