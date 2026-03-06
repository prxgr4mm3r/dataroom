import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import type { UserProfile } from '@/entities/user'
import { useFolderTreeQuery } from '@/features/load-folder-tree'
import { useListContentItemsQuery } from '@/features/list-content-items'
import { useOpenFilePreview } from '@/features/open-file-preview'
import { useSelectionStore } from '@/features/select-content-items'
import { useSortState } from '@/features/sort-content-items'
import { AppShell } from '@/widgets/app-shell'
import { BreadcrumbsBar } from '@/widgets/breadcrumbs-bar'
import { BulkActionsBar } from '@/widgets/bulk-actions-bar'
import { DataroomSidebar } from '@/widgets/dataroom-sidebar'
import { DataroomToolbar } from '@/widgets/dataroom-toolbar'
import { FileTable } from '@/widgets/file-table'
import { ImportFileDialog } from '@/widgets/import-file-dialog'
import { PreviewPane } from '@/widgets/preview-pane'
import { notifySuccess } from '@/shared/ui'
import { Alert, Box, Text } from '@/shared/ui'
import { normalizeFolderId, toFolderPath } from '@/shared/routes/dataroom-routes'
import { t } from '@/shared/i18n/messages'

import './dataroom-page.css'

type DataroomPageProps = {
  currentUser: UserProfile
}

export const DataroomPage = ({ currentUser }: DataroomPageProps) => {
  const { folderId } = useParams<{ folderId: string }>()
  const normalizedFolderId = normalizeFolderId(folderId)

  const [searchParams] = useSearchParams()
  const previewId = searchParams.get('preview')

  const [importDialogOpened, setImportDialogOpened] = useState(false)

  const navigate = useNavigate()

  const { sortBy, sortOrder, toggleSort } = useSortState()

  const folderTreeQuery = useFolderTreeQuery(true)
  const listQuery = useListContentItemsQuery(normalizedFolderId, sortBy, sortOrder)
  const openFilePreview = useOpenFilePreview(normalizedFolderId)

  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const toggleSelected = useSelectionStore((state) => state.toggle)
  const clearSelection = useSelectionStore((state) => state.clear)

  useEffect(() => {
    clearSelection()
  }, [clearSelection, normalizedFolderId])

  const breadcrumbs = useMemo(() => listQuery.data?.breadcrumbs || [], [listQuery.data?.breadcrumbs])

  const openFolder = (id: string) => {
    navigate(toFolderPath(id))
  }

  return (
    <>
      <AppShell
        sidebar={
          <DataroomSidebar
            tree={folderTreeQuery.data}
            activeFolderId={normalizedFolderId}
            onOpenFolder={openFolder}
          />
        }
        toolbar={
          <DataroomToolbar
            currentUser={currentUser}
            onImportFile={() => setImportDialogOpened(true)}
            onNewFolder={() => notifySuccess(t('newFolderSoon'))}
          />
        }
        breadcrumbs={<BreadcrumbsBar breadcrumbs={breadcrumbs} onNavigate={openFolder} />}
        content={
          <div className="dataroom-page__content">
            <Box className="dataroom-page__table">
              {listQuery.error ? (
                <Alert color="red" m="md" title="Failed to load items">
                  {(listQuery.error as Error).message}
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
                />
              )}
            </Box>
            <PreviewPane folderId={normalizedFolderId} previewItemId={previewId} />
          </div>
        }
        bulkActions={
          <BulkActionsBar selectedCount={selectedIds.length} onClearSelection={clearSelection} />
        }
      />

      <ImportFileDialog
        opened={importDialogOpened}
        folderId={normalizedFolderId}
        onClose={() => setImportDialogOpened(false)}
      />

      {folderTreeQuery.error ? (
        <Text c="red" size="sm" px="md" pb="xs">
          Failed to load folder tree.
        </Text>
      ) : null}
    </>
  )
}
