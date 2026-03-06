import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import type { ContentItem } from '@/entities/content-item'
import type { UserProfile } from '@/entities/user'
import { useBulkDeleteItems, useDeleteItem } from '@/features/delete-content-items'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { useOpenFilePreview } from '@/features/open-file-preview'
import { useSelectionStore } from '@/features/select-content-items'
import { useSortState } from '@/features/sort-content-items'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { normalizeFolderId, toFolderPath, withPreviewQuery } from '@/shared/routes/dataroom-routes'
import { Alert, Box } from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'
import { AppShell } from '@/widgets/app-shell'
import { BreadcrumbsBar } from '@/widgets/breadcrumbs-bar'
import { BulkActionsBar } from '@/widgets/bulk-actions-bar'
import { CreateFolderDialog } from '@/widgets/create-folder-dialog'
import { DataroomSidebar } from '@/widgets/dataroom-sidebar'
import { DataroomToolbar } from '@/widgets/dataroom-toolbar'
import { DeleteItemsDialog } from '@/widgets/delete-items-dialog'
import { FileTable } from '@/widgets/file-table'
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

export const DataroomPage = ({ currentUser }: DataroomPageProps) => {
  const { folderId } = useParams<{ folderId: string }>()
  const normalizedFolderId = normalizeFolderId(folderId)

  const [searchParams] = useSearchParams()
  const previewId = searchParams.get('preview')

  const [importDialogOpened, setImportDialogOpened] = useState(false)
  const [createFolderOpened, setCreateFolderOpened] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)

  const navigate = useNavigate()

  const { sortBy, sortOrder, toggleSort } = useSortState()

  const listQuery = useListContentItemsQuery(normalizedFolderId, sortBy, sortOrder)
  const openFilePreview = useOpenFilePreview(normalizedFolderId)

  const deleteItemMutation = useDeleteItem(normalizedFolderId)
  const bulkDeleteMutation = useBulkDeleteItems(normalizedFolderId)

  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const toggleSelected = useSelectionStore((state) => state.toggle)
  const clearSelection = useSelectionStore((state) => state.clear)
  const setSelected = useSelectionStore((state) => state.setMany)

  useEffect(() => {
    clearSelection()
  }, [clearSelection, normalizedFolderId])

  const breadcrumbs = useMemo(() => listQuery.data?.breadcrumbs || [], [listQuery.data?.breadcrumbs])
  const expandedPathIds = useMemo(() => breadcrumbs.map((crumb) => crumb.id), [breadcrumbs])

  const openFolder = (id: string) => {
    navigate(toFolderPath(id))
  }

  const openFileFromSidebar = (fileId: string, parentFolderId: string) => {
    navigate(`${toFolderPath(parentFolderId)}${withPreviewQuery(fileId)}`)
  }

  const closePreviewIfDeleted = (deletedIds: string[]) => {
    if (previewId && deletedIds.includes(previewId)) {
      navigate(toFolderPath(normalizedFolderId), { replace: true })
    }
  }

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
        closePreviewIfDeleted([deleteDialog.item.id])
        setSelected(selectedIds.filter((id) => id !== deleteDialog.item.id))
        notifySuccess(t('deleteItemSuccess'))
      } else {
        await bulkDeleteMutation.mutateAsync(selectedIds)
        closePreviewIfDeleted(selectedIds)
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

  return (
    <>
      <AppShell
        sidebar={
          <DataroomSidebar
            activeFolderId={normalizedFolderId}
            activePreviewId={previewId}
            expandedPathIds={expandedPathIds}
            onOpenFolder={openFolder}
            onOpenFile={openFileFromSidebar}
          />
        }
        toolbar={
          <DataroomToolbar
            currentUser={currentUser}
            onImportFile={() => setImportDialogOpened(true)}
            onNewFolder={() => setCreateFolderOpened(true)}
          />
        }
        breadcrumbs={<BreadcrumbsBar breadcrumbs={breadcrumbs} onNavigate={openFolder} />}
        content={
          <div className="dataroom-page__content">
            <Box className="dataroom-page__table">
              {listQuery.error ? (
                <Alert color="red" m="md" title="Failed to load items">
                  {toApiError(listQuery.error).message}
                </Alert>
              ) : (
                <FileTable
                  items={listQuery.data?.items || []}
                  loading={listQuery.isPending}
                  openedPreviewId={previewId}
                  selectedIds={selectedIds}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onToggleSort={toggleSort}
                  onToggleSelect={toggleSelected}
                  onOpenFile={openFilePreview}
                  onOpenFolder={openFolder}
                  onDeleteItem={openSingleDeleteDialog}
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
            onDeleteSelected={openBulkDeleteDialog}
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

    </>
  )
}
