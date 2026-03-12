import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/app/providers'
import type { ContentItem } from '@/entities/content-item'
import type { UserProfile } from '@/entities/user'
import { useContentTreeBrowser } from '@/features/browse-content-tree'
import { useDataroomShortcuts } from '@/features/dataroom-shortcuts'
import { useDownloadContentItems } from '@/features/download-content-items'
import { useDragImportController } from '@/features/drag-import-files'
import { useDragMoveController } from '@/features/drag-move-items'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { useOpenFilePreview } from '@/features/open-file-preview'
import { useSortState } from '@/features/sort-content-items'
import { useFolderTreeQuery } from '@/features/load-folder-tree'
import { useDataroomDelete } from '@/pages/dataroom-page/model/use-dataroom-delete'
import { useDataroomImport } from '@/pages/dataroom-page/model/use-dataroom-import'
import { useDataroomSelection } from '@/pages/dataroom-page/model/use-dataroom-selection'
import { useDataroomTransfer } from '@/pages/dataroom-page/model/use-dataroom-transfer'
import { resolveVisibleFileContentFolderIds } from '@/pages/dataroom-page/model/resolve-visible-file-content-folder-ids'
import { toApiError } from '@/shared/api'
import {
  normalizeFolderId,
  toFolderPath,
  withPreviewQuery,
} from '@/shared/routes/dataroom-routes'
import { Alert, Box } from '@/shared/ui'
import { notifyError } from '@/shared/ui'
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

type DataroomPageProps = {
  currentUser: UserProfile
}

type DropState = 'none' | 'valid' | 'warning' | 'invalid'
const SYNTHETIC_FOLDER_TIMESTAMP = '1970-01-01T00:00:00.000Z'
const DOWNLOAD_FALLBACK_NAME = 'dataroom-download.zip'
const ZIP_EXTENSION_PATTERN = /\.zip$/i
const ROOT_FOLDER_NAME = 'Data Room'

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

  const [createFolderOpened, setCreateFolderOpened] = useState(false)
  const [createFolderParentId, setCreateFolderParentId] = useState<string>(normalizedFolderId)
  const [shareDialogItem, setShareDialogItem] = useState<ContentItem | null>(null)
  const [renameDialogItem, setRenameDialogItem] = useState<ContentItem | null>(null)
  const [searchDialogOpened, setSearchDialogOpened] = useState(false)
  const [shortcutsDialogOpened, setShortcutsDialogOpened] = useState(false)
  const [manualFileContentVisibleFolderIds, setManualFileContentVisibleFolderIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [knownFolderItemCounts, setKnownFolderItemCounts] = useState<Record<string, number>>({})

  const navigate = useNavigate()

  const handleSignOut = () => {
    navigate(toFolderPath(), { replace: true })
    void signOutUser()
  }

  const {
    importDialogOpened,
    openGoogleImportDialog,
    closeGoogleImportDialog,
    dragImportResultDialog,
    openDragImportResultDialog,
    closeDragImportResultDialog,
    nativeImportInputRef,
    importFromComputerPending,
    openComputerImportPicker,
    onComputerImportSelected,
    handleExternalDragImportResult,
  } = useDataroomImport({ normalizedFolderId })

  useEffect(() => {
    if (searchParams.get('import') !== 'google') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      openGoogleImportDialog()
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
  }, [location.pathname, navigate, openGoogleImportDialog, searchParams])

  const { sortBy, sortOrder, toggleSort } = useSortState()

  const listQuery = useListContentItemsQuery(normalizedFolderId, sortBy, sortOrder)
  const folderTreeQuery = useFolderTreeQuery(true)
  const openFilePreview = useOpenFilePreview(normalizedFolderId)
  const { folderNodeById, folderParentIdById } = useMemo(() => {
    const nodeById = new Map<string, { id: string; name: string; childrenCount: number }>()
    const parentById = new Map<string, string | null>()
    const rootNode = folderTreeQuery.data

    if (rootNode) {
      const stack: Array<{ node: typeof rootNode; parentId: string | null }> = [
        { node: rootNode, parentId: null },
      ]

      while (stack.length) {
        const current = stack.pop()
        if (!current) {
          continue
        }

        nodeById.set(current.node.id, {
          id: current.node.id,
          name: current.node.name,
          childrenCount: current.node.children.length,
        })
        parentById.set(current.node.id, current.parentId)

        for (let index = current.node.children.length - 1; index >= 0; index -= 1) {
          stack.push({
            node: current.node.children[index],
            parentId: current.node.id,
          })
        }
      }
    }

    return {
      folderNodeById: nodeById,
      folderParentIdById: parentById,
    }
  }, [folderTreeQuery.data])

  const downloadItemsMutation = useDownloadContentItems()

  const items = useMemo(() => listQuery.data?.items || [], [listQuery.data?.items])

  useEffect(() => {
    if (!listQuery.data) {
      return
    }

    const responseFolderId = normalizeFolderId(listQuery.data.folder.id)
    if (responseFolderId !== normalizedFolderId) {
      return
    }

    setKnownFolderItemCounts((current) => ({
      ...current,
      [responseFolderId]: listQuery.data.items.length,
    }))
  }, [listQuery.data, normalizedFolderId])

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const breadcrumbs = useMemo(() => listQuery.data?.breadcrumbs || [], [listQuery.data?.breadcrumbs])
  const orderedItemIds = useMemo(() => items.map((item) => item.id), [items])
  const {
    selectedIds,
    clearSelectedItems,
    setSelectedAndSyncAnchor,
    getSingleSelectedItem,
    handleToggleSelect,
    selectAllVisibleItems,
    excludeIdsFromSelection,
  } = useDataroomSelection({
    normalizedFolderId,
    items,
    orderedItemIds,
    itemMap,
  })

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
      const treeFolder = folderNodeById.get(folderId)
      if (!treeFolder) {
        return null
      }

      const parentFolderId = folderParentIdById.get(folderId) ?? null

      return {
        id: treeFolder.id,
        kind: 'folder',
        name: treeFolder.name,
        parentId: parentFolderId && parentFolderId !== 'root' ? parentFolderId : null,
        childrenCount: treeFolder.childrenCount,
        status: 'active',
        createdAt: SYNTHETIC_FOLDER_TIMESTAMP,
        updatedAt: SYNTHETIC_FOLDER_TIMESTAMP,
        mimeType: null,
        sizeBytes: null,
        fileCount: treeFolder.childrenCount,
        importedAt: null,
        origin: null,
        googleFileId: null,
      }
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
      fileCount: 0,
      importedAt: null,
      origin: null,
      googleFileId: null,
    }
  }
  const setFolderFileContentVisibility = (folderId: string, visible: boolean) => {
    const normalizedId = normalizeFolderId(folderId)
    setManualFileContentVisibleFolderIds((previous) => {
      const next = new Set(previous)
      if (visible) {
        next.add(normalizedId)
      } else {
        next.delete(normalizedId)
      }
      return next
    })
  }

  const fileContentVisibleFolderIds = useMemo(() => {
    return resolveVisibleFileContentFolderIds(manualFileContentVisibleFolderIds, normalizedFolderId)
  }, [manualFileContentVisibleFolderIds, normalizedFolderId])

  const expandedPathIds = useMemo(() => breadcrumbs.map((crumb) => crumb.id), [breadcrumbs])
  const treeBrowser = useContentTreeBrowser({
    activeFolderId: normalizedFolderId,
    expandedPathIds,
  })
  const expandTreeFolder = treeBrowser.expand
  const previousItemsCountRef = useRef<number | null>(null)

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

  const openCreateFolderDialog = (folderId: string = normalizedFolderId) => {
    setCreateFolderParentId(normalizeFolderId(folderId))
    setCreateFolderOpened(true)
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

  const {
    transferDialog,
    targetFolderId,
    setTargetFolderId,
    transferPending,
    transferError,
    transferDialogTitle,
    transferConfirmLabel,
    bulkCopyPending,
    bulkMovePending,
    getTransferTargetError,
    openSingleCopyDialog,
    openSingleMoveDialog,
    openBulkCopyDialog,
    openBulkMoveDialog,
    closeTransferDialog,
    onConfirmTransfer,
    moveItemsToFolder,
  } = useDataroomTransfer({
    normalizedFolderId,
    selectedIds,
    folderTree: folderTreeQuery.data,
    resolveItems: (itemIds) =>
      itemIds.map((id) => getFolderActionItem(id)).filter((item): item is ContentItem => Boolean(item)),
    closePreviewIfMoved,
    excludeIdsFromSelection,
  })

  const {
    deleteDialog,
    deletePending,
    deleteError,
    deleteDialogTitle,
    deleteDialogMessage,
    bulkDeletePending,
    openSingleDeleteDialog,
    openBulkDeleteDialog,
    closeDeleteDialog,
    onConfirmDelete,
  } = useDataroomDelete({
    normalizedFolderId,
    breadcrumbs,
    selectedIds,
    clearSelectedItems,
    excludeIdsFromSelection,
    closePreviewIfMoved,
    navigateToFolderReplace: (folderId) => {
      navigate(toFolderPath(folderId), { replace: true })
    },
  })

  const dragMoveController = useDragMoveController({
    items,
    selectedIds,
    folderTree: folderTreeQuery.data,
    onInvalidDrop: (message) => notifyError(message),
    onMoveItems: moveItemsToFolder,
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
        handleExternalDragImportResult(result)
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
      fileCount: items.filter((item) => item.kind === 'file').length,
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
            folderTree={folderTreeQuery.data}
            activeFolderId={normalizedFolderId}
            activePreviewId={previewId}
            expandedIds={treeBrowser.expandedIds}
            fileContentVisibleFolderIds={fileContentVisibleFolderIds}
            knownFolderItemCounts={knownFolderItemCounts}
            onNewFolder={() => openCreateFolderDialog(normalizedFolderId)}
            onImportFromGoogle={openGoogleImportDialog}
            onImportFromComputer={openComputerImportPicker}
            onToggleExpanded={treeBrowser.toggleExpanded}
            onSetFileContentVisibility={setFolderFileContentVisibility}
            onOpenFolder={openFolder}
            onOpenFile={openFileFromSidebar}
            onSignOut={handleSignOut}
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
            getFolderItem={getFolderActionItem}
          />
        }
        collapsedSidebar={
          <DataroomSidebarRail
            currentUser={currentUser}
            onNewFolder={() => openCreateFolderDialog(normalizedFolderId)}
            onImportFromGoogle={openGoogleImportDialog}
            onImportFromComputer={openComputerImportPicker}
            onSignOut={handleSignOut}
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
          <div className="flex h-full min-h-0">
            <Box className="min-h-0 min-w-0 flex-1">
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
                  importFromComputerPending={importFromComputerPending}
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
                  copyPending={bulkCopyPending}
                  movePending={bulkMovePending}
                  deletePending={bulkDeletePending}
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
        onClose={closeGoogleImportDialog}
        onPartialImportResult={openDragImportResultDialog}
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
        onClose={closeDeleteDialog}
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
        getTargetError={getTransferTargetError}
        onSelectFolder={setTargetFolderId}
        onConfirm={() => void onConfirmTransfer()}
        onClose={closeTransferDialog}
      />

      <ImportResultsDialog
        opened={Boolean(dragImportResultDialog)}
        uploadedFiles={dragImportResultDialog?.uploadedFiles ?? []}
        failedFiles={dragImportResultDialog?.failedFiles ?? []}
        onClose={closeDragImportResultDialog}
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
