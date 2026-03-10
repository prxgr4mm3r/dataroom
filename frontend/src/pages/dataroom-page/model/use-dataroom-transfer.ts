import { useState } from 'react'

import type { ContentItem } from '@/entities/content-item'
import type { FolderNode } from '@/entities/folder'
import { useBulkCopyItems, useCopyItem } from '@/features/copy-content-items'
import { validateMoveTarget } from '@/features/drag-move-items'
import { useBulkMoveItems, useMoveItem } from '@/features/move-content-items'
import { toApiError } from '@/shared/api'
import { t } from '@/shared/i18n/messages'
import { normalizeFolderId, toNullableFolderId } from '@/shared/routes/dataroom-routes'
import { notifyError, notifySuccess } from '@/shared/ui'

type TransferMode = 'copy' | 'move'

type TransferDialogState = {
  mode: TransferMode
  scope: 'single' | 'bulk'
  itemIds: string[]
  label: string
}

type UseDataroomTransferParams = {
  normalizedFolderId: string
  selectedIds: string[]
  folderTree: FolderNode | undefined
  resolveItems: (itemIds: string[]) => ContentItem[]
  closePreviewIfMoved: (movedIds: string[], destinationFolderId: string) => void
  excludeIdsFromSelection: (excludedIds: string[]) => void
}

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

export const useDataroomTransfer = ({
  normalizedFolderId,
  selectedIds,
  folderTree,
  resolveItems,
  closePreviewIfMoved,
  excludeIdsFromSelection,
}: UseDataroomTransferParams) => {
  const [transferDialog, setTransferDialog] = useState<TransferDialogState | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string>('root')

  const copyItemMutation = useCopyItem()
  const bulkCopyMutation = useBulkCopyItems()
  const moveItemMutation = useMoveItem()
  const bulkMoveMutation = useBulkMoveItems()

  const getTargetError = (mode: TransferMode, itemIds: string[], folderIdCandidate: string): string | null => {
    const normalizedTarget = normalizeFolderId(folderIdCandidate)
    const transferItems = resolveItems(itemIds)
    const validation = validateMoveTarget(transferItems, normalizedTarget, folderTree)

    if (mode === 'copy' && validation.reason === 'same_parent') {
      return null
    }

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

    if (!folderTree) {
      return preferred
    }

    const stack: Array<FolderNode> = [folderTree]
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
        excludeIdsFromSelection(transferDialog.itemIds)
        notifySuccess(t('moveItemSuccess'))
      } else {
        await bulkMoveMutation.mutateAsync({
          itemIds: transferDialog.itemIds,
          targetFolderId: targetFolderNullable,
        })
        closePreviewIfMoved(transferDialog.itemIds, targetFolderId)
        excludeIdsFromSelection(transferDialog.itemIds)
        notifySuccess(t('moveItemsSuccess'))
      }

      closeTransferDialog()
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

  const moveItemsToFolder = async (itemIds: string[], destinationFolderId: string) => {
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
      excludeIdsFromSelection(itemIds)
    } catch (error) {
      notifyError(toApiError(error).message)
    }
  }

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

  const bulkCopyPending = Boolean(
    transferDialog?.mode === 'copy' && transferDialog.scope === 'bulk' && transferPending,
  )
  const bulkMovePending = Boolean(
    transferDialog?.mode === 'move' && transferDialog.scope === 'bulk' && transferPending,
  )

  return {
    transferDialog,
    targetFolderId,
    setTargetFolderId,
    transferPending,
    transferError,
    transferDialogTitle,
    transferConfirmLabel,
    bulkCopyPending,
    bulkMovePending,
    getTransferTargetError: (folderIdCandidate: string) => {
      if (!transferDialog) {
        return null
      }
      return getTargetError(transferDialog.mode, transferDialog.itemIds, folderIdCandidate)
    },
    openSingleCopyDialog,
    openSingleMoveDialog,
    openBulkCopyDialog,
    openBulkMoveDialog,
    closeTransferDialog,
    onConfirmTransfer,
    moveItemsToFolder,
  }
}
