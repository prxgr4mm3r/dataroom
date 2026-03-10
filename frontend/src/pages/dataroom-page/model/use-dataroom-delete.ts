import { useState } from 'react'

import type { ContentItem } from '@/entities/content-item'
import type { Breadcrumb } from '@/entities/folder'
import { useBulkDeleteItems, useDeleteItem } from '@/features/delete-content-items'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { normalizeFolderId } from '@/shared/routes/dataroom-routes'
import { notifyError, notifySuccess } from '@/shared/ui'

type DeleteDialogState =
  | {
      mode: 'single'
      item: ContentItem
    }
  | {
      mode: 'bulk'
    }

type UseDataroomDeleteParams = {
  normalizedFolderId: string
  breadcrumbs: Breadcrumb[]
  selectedIds: string[]
  clearSelectedItems: () => void
  excludeIdsFromSelection: (excludedIds: string[]) => void
  closePreviewIfMoved: (movedIds: string[], destinationFolderId: string) => void
  navigateToFolderReplace: (folderId: string) => void
}

export const useDataroomDelete = ({
  normalizedFolderId,
  breadcrumbs,
  selectedIds,
  clearSelectedItems,
  excludeIdsFromSelection,
  closePreviewIfMoved,
  navigateToFolderReplace,
}: UseDataroomDeleteParams) => {
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)

  const deleteItemMutation = useDeleteItem(normalizedFolderId)
  const bulkDeleteMutation = useBulkDeleteItems(normalizedFolderId)

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

  const closeDeleteDialog = () => {
    setDeleteDialog(null)
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
        const isDeletedFolderAncestorOfCurrent =
          deletedFolderPathIndex >= 0 && deletedFolderPathIndex < breadcrumbs.length - 1

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
        excludeIdsFromSelection([deleteDialog.item.id])
      } else {
        await bulkDeleteMutation.mutateAsync(selectedIds)
        closePreviewIfMoved(selectedIds, normalizedFolderId)
        clearSelectedItems()
      }

      setDeleteDialog(null)

      if (navigationTargetFolderIdAfterDelete) {
        navigateToFolderReplace(navigationTargetFolderIdAfterDelete)
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

  return {
    deleteDialog,
    deletePending,
    deleteError,
    deleteDialogTitle,
    deleteDialogMessage,
    bulkDeletePending: deleteDialog?.mode === 'bulk' && bulkDeleteMutation.isPending,
    openSingleDeleteDialog,
    openBulkDeleteDialog,
    closeDeleteDialog,
    onConfirmDelete,
  }
}
