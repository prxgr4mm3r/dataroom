import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/app/providers'
import type { ContentItem } from '@/entities/content-item'
import type { UserProfile } from '@/entities/user'
import { useContentTreeBrowser } from '@/features/browse-content-tree'
import { useBulkCopyItems, useCopyItem } from '@/features/copy-content-items'
import { useBulkDeleteItems, useDeleteItem } from '@/features/delete-content-items'
import { useDragMoveController, validateMoveTarget } from '@/features/drag-move-items'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { useBulkMoveItems, useMoveItem } from '@/features/move-content-items'
import { useOpenFilePreview } from '@/features/open-file-preview'
import { useSelectionStore } from '@/features/select-content-items'
import { useSortState } from '@/features/sort-content-items'
import { useFolderTreeQuery } from '@/features/load-folder-tree'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import {
  normalizeFolderId,
  toFolderPath,
  toNullableFolderId,
  withPreviewQuery,
} from '@/shared/routes/dataroom-routes'
import { Alert, Box } from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'
import { AppShell } from '@/widgets/app-shell'
import { BulkActionsBar } from '@/widgets/bulk-actions-bar'
import { CreateFolderDialog } from '@/widgets/create-folder-dialog'
import { DataroomSidebar, DataroomSidebarRail } from '@/widgets/dataroom-sidebar'
import { DataroomToolbar } from '@/widgets/dataroom-toolbar'
import { DeleteItemsDialog } from '@/widgets/delete-items-dialog'
import { FileTable } from '@/widgets/file-table'
import { FolderPickerDialog } from '@/widgets/folder-picker-dialog'
import { ImportFileDialog } from '@/widgets/import-file-dialog'
import { PreviewPane } from '@/widgets/preview-pane'

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

const moveReasonMessage = (reason: ReturnType<typeof validateMoveTarget>['reason']): string | null => {
  if (reason === 'self') {
    return t('invalidMoveSelf')
  }
  if (reason === 'descendant') {
    return t('invalidMoveDescendant')
  }
  if (reason === 'target_not_found') {
    return t('invalidMoveTarget')
  }
  return null
}

export const DataroomPage = ({ currentUser }: DataroomPageProps) => {
  const { signOutUser } = useAuth()
  const { folderId } = useParams<{ folderId: string }>()
  const normalizedFolderId = normalizeFolderId(folderId)

  const [searchParams] = useSearchParams()
  const previewId = searchParams.get('preview')

  const [importDialogOpened, setImportDialogOpened] = useState(false)
  const [createFolderOpened, setCreateFolderOpened] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [transferDialog, setTransferDialog] = useState<TransferDialogState | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string>('root')

  const navigate = useNavigate()

  const { sortBy, sortOrder, toggleSort } = useSortState()

  const listQuery = useListContentItemsQuery(normalizedFolderId, sortBy, sortOrder)
  const folderTreeQuery = useFolderTreeQuery(true)
  const openFilePreview = useOpenFilePreview(normalizedFolderId)

  const deleteItemMutation = useDeleteItem(normalizedFolderId)
  const bulkDeleteMutation = useBulkDeleteItems(normalizedFolderId)
  const copyItemMutation = useCopyItem()
  const bulkCopyMutation = useBulkCopyItems()
  const moveItemMutation = useMoveItem()
  const bulkMoveMutation = useBulkMoveItems()

  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const toggleSelected = useSelectionStore((state) => state.toggle)
  const clearSelection = useSelectionStore((state) => state.clear)
  const setSelected = useSelectionStore((state) => state.setMany)

  useEffect(() => {
    clearSelection()
  }, [clearSelection, normalizedFolderId])

  const items = useMemo(() => listQuery.data?.items || [], [listQuery.data?.items])
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const breadcrumbs = useMemo(() => listQuery.data?.breadcrumbs || [], [listQuery.data?.breadcrumbs])
  const expandedPathIds = useMemo(() => breadcrumbs.map((crumb) => crumb.id), [breadcrumbs])
  const treeBrowser = useContentTreeBrowser({
    activeFolderId: normalizedFolderId,
    expandedPathIds,
  })

  const openFolder = (id: string) => {
    navigate(toFolderPath(id))
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
    itemIds.map((id) => itemMap.get(id)).filter((item): item is ContentItem => Boolean(item))

  const getTargetError = (mode: TransferMode, itemIds: string[], folderIdCandidate: string): string | null => {
    const normalizedTarget = normalizeFolderId(folderIdCandidate)

    if (mode === 'copy') {
      if (normalizedTarget !== 'root' && !folderTreeQuery.data) {
        return t('invalidMoveTarget')
      }
      return null
    }

    const movingItems = getMovingItems(itemIds)
    const validation = validateMoveTarget(movingItems, normalizedTarget, folderTreeQuery.data)
    return moveReasonMessage(validation.reason)
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
    setTargetFolderId(normalizedFolderId)
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
      notifyError(targetError)
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
        setSelected(selectedIds.filter((id) => !transferDialog.itemIds.includes(id)))
        notifySuccess(t('moveItemSuccess'))
      } else {
        await bulkMoveMutation.mutateAsync({
          itemIds: transferDialog.itemIds,
          targetFolderId: targetFolderNullable,
        })
        closePreviewIfMoved(transferDialog.itemIds, targetFolderId)
        setSelected(selectedIds.filter((id) => !transferDialog.itemIds.includes(id)))
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
        setSelected(selectedIds.filter((id) => !itemIds.includes(id)))
      } catch (error) {
        notifyError(toApiError(error).message)
      }
    },
  })

  const openSingleDeleteDialog = (item: ContentItem) => {
    deleteItemMutation.reset()
    bulkDeleteMutation.reset()
    setDeleteDialog({ mode: 'single', item })
  }

  const openBulkDeleteDialog = () => {
    if (!selectedIds.length) {
      return
    }
    deleteItemMutation.reset()
    bulkDeleteMutation.reset()
    setDeleteDialog({ mode: 'bulk' })
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
      if (deleteDialog.mode === 'single') {
        await deleteItemMutation.mutateAsync(deleteDialog.item.id)
        closePreviewIfMoved([deleteDialog.item.id], normalizedFolderId)
        setSelected(selectedIds.filter((id) => id !== deleteDialog.item.id))
        notifySuccess(t('deleteItemSuccess'))
      } else {
        await bulkDeleteMutation.mutateAsync(selectedIds)
        closePreviewIfMoved(selectedIds, normalizedFolderId)
        clearSelection()
        notifySuccess(t('deleteItemsSuccess'))
      }

      setDeleteDialog(null)
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

  return (
    <>
      <AppShell
        sidebar={
          <DataroomSidebar
            currentUser={currentUser}
            activeFolderId={normalizedFolderId}
            activePreviewId={previewId}
            expandedIds={treeBrowser.expandedIds}
            onGoRoot={() => openFolder('root')}
            onNewFolder={() => setCreateFolderOpened(true)}
            onImportFile={() => setImportDialogOpened(true)}
            onToggleExpanded={treeBrowser.toggleExpanded}
            onOpenFolder={openFolder}
            onOpenFile={openFileFromSidebar}
            onSignOut={() => void signOutUser()}
            onDragStartItem={dragMoveController.startDragFromTree}
            onDragEnd={dragMoveController.endDrag}
            onFolderDragOver={dragMoveController.dragOverFolder}
            onFolderDrop={(folderId, event) => {
              void dragMoveController.dropOnFolder(folderId, event)
            }}
            onFolderDragLeave={dragMoveController.dragLeaveFolder}
            getFolderDropState={dragMoveController.getFolderDropState}
            isDraggingItem={dragMoveController.isDraggingItem}
          />
        }
        collapsedSidebar={
          <DataroomSidebarRail
            currentUser={currentUser}
            onGoRoot={() => openFolder('root')}
            onNewFolder={() => setCreateFolderOpened(true)}
            onImportFile={() => setImportDialogOpened(true)}
            onSignOut={() => void signOutUser()}
          />
        }
        header={
          <DataroomToolbar
            breadcrumbs={breadcrumbs}
            onNavigate={openFolder}
            onImportFile={() => setImportDialogOpened(true)}
            onNewFolder={() => setCreateFolderOpened(true)}
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
                  loading={listQuery.isPending}
                  currentFolderId={normalizedFolderId}
                  openedPreviewId={previewId}
                  selectedIds={selectedIds}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onToggleSort={toggleSort}
                  onToggleSelect={toggleSelected}
                  onOpenFile={openFilePreview}
                  onOpenFolder={openFolder}
                  onCopyItem={openSingleCopyDialog}
                  onMoveItem={openSingleMoveDialog}
                  onDeleteItem={openSingleDeleteDialog}
                  onDragStartItem={dragMoveController.startDragFromTable}
                  onDragEnd={dragMoveController.endDrag}
                  onFolderDragOver={dragMoveController.dragOverFolder}
                  onFolderDragLeave={dragMoveController.dragLeaveFolder}
                  onFolderDrop={(folderId, event) => {
                    void dragMoveController.dropOnFolder(folderId, event)
                  }}
                  getFolderDropState={dragMoveController.getFolderDropState}
                  isDraggingItem={dragMoveController.isDraggingItem}
                />
              )}
            </Box>
            <PreviewPane folderId={normalizedFolderId} previewItemId={previewId} />
          </div>
        }
        bulkActions={
          <BulkActionsBar
            selectedCount={selectedIds.length}
            onClearSelection={clearSelection}
            onCopySelected={openBulkCopyDialog}
            onMoveSelected={openBulkMoveDialog}
            onDeleteSelected={openBulkDeleteDialog}
            copyPending={Boolean(
              transferDialog?.mode === 'copy' && transferDialog.scope === 'bulk' && transferPending,
            )}
            movePending={Boolean(
              transferDialog?.mode === 'move' && transferDialog.scope === 'bulk' && transferPending,
            )}
            deletePending={deleteDialog?.mode === 'bulk' && bulkDeleteMutation.isPending}
          />
        }
      />

      <ImportFileDialog
        opened={importDialogOpened}
        folderId={normalizedFolderId}
        onClose={() => setImportDialogOpened(false)}
      />

      <CreateFolderDialog
        opened={createFolderOpened}
        folderId={normalizedFolderId}
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
    </>
  )
}
