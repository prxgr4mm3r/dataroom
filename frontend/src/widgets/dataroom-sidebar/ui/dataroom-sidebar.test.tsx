import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContentItem } from '@/entities/content-item'
import type { FolderNode } from '@/entities/folder'
import type { UserProfile } from '@/entities/user'
import { TestProvider } from '@/shared/ui/test-provider'

import { DataroomSidebar } from './dataroom-sidebar'

const useListContentItemsQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/list-content-items', () => ({
  useListContentItemsQuery: useListContentItemsQueryMock,
}))

const makeFile = (folderId: string): ContentItem => ({
  id: `file-${folderId}`,
  kind: 'file',
  name: `${folderId}.txt`,
  parentId: folderId === 'root' ? null : folderId,
  childrenCount: 0,
  status: 'active',
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
  mimeType: 'text/plain',
  sizeBytes: 12,
  fileCount: null,
  importedAt: null,
  origin: null,
  googleFileId: null,
})

const user: UserProfile = {
  id: 'u-1',
  firebaseUid: 'fb-1',
  email: 'user@example.com',
  displayName: 'User',
  photoUrl: null,
}

const folderTree: FolderNode = {
  id: 'root',
  name: 'Data Room',
  children: [
    {
      id: 'folder-1',
      name: 'Folder 1',
      children: [],
    },
  ],
}

const defaultProps = {
  currentUser: user,
  folderTree,
  activeFolderId: 'root',
  activePreviewId: null,
  expandedIds: new Set<string>(['root']),
  fileContentVisibleFolderIds: new Set<string>(['root']),
  knownFolderItemCounts: {},
  onNewFolder: () => undefined,
  onImportFromGoogle: () => undefined,
  onImportFromComputer: () => undefined,
  onToggleExpanded: () => undefined,
  onSetFileContentVisibility: () => undefined,
  onOpenFolder: () => undefined,
  onOpenFile: () => undefined,
  onSignOut: () => undefined,
  onDownloadItem: () => undefined,
  onCopyItem: () => undefined,
  onRenameItem: () => undefined,
  onMoveItem: () => undefined,
  onDeleteItem: () => undefined,
  onShareItem: () => undefined,
  onRootCreateFolder: () => undefined,
  onRootDownload: () => undefined,
  onRootShare: () => undefined,
  onDragStartItem: () => undefined,
  onDragEnd: () => undefined,
  onFolderDragOver: () => undefined,
  onFolderDrop: () => undefined,
  onFolderDragLeave: () => undefined,
  getFolderDropState: () => 'none' as const,
  isDraggingItem: () => false,
  getFolderItem: () => null,
}

const renderWithTheme = (ui: ReactElement) => render(<TestProvider>{ui}</TestProvider>)

describe('DataroomSidebar lazy file loading', () => {
  beforeEach(() => {
    useListContentItemsQueryMock.mockReset()
  })

  it('fetches root files by default when root is expanded', () => {
    useListContentItemsQueryMock.mockImplementation((folderId: string) => ({
      isPending: false,
      error: null,
      data: {
        folder: {
          id: folderId,
          name: folderId,
          parentId: folderId === 'root' ? 'root' : 'root',
        },
        breadcrumbs: [],
        items: [makeFile(folderId)],
      },
    }))

    renderWithTheme(<DataroomSidebar {...defaultProps} />)

    const calledFolderIds = useListContentItemsQueryMock.mock.calls.map((args: unknown[]) => args[0])
    expect(calledFolderIds).toContain('root')
  })

  it('keeps non-root folders lazy until they are expanded and marked visible', () => {
    useListContentItemsQueryMock.mockImplementation((folderId: string) => ({
      isPending: false,
      error: null,
      data: {
        folder: {
          id: folderId,
          name: folderId,
          parentId: folderId === 'root' ? 'root' : 'root',
        },
        breadcrumbs: [],
        items: [makeFile(folderId)],
      },
    }))

    const { rerender } = renderWithTheme(<DataroomSidebar {...defaultProps} />)

    const firstRenderCalledIds = useListContentItemsQueryMock.mock.calls.map((args: unknown[]) => args[0])
    expect(firstRenderCalledIds).not.toContain('folder-1')

    useListContentItemsQueryMock.mockClear()

    rerender(
      <TestProvider>
        <DataroomSidebar
          {...defaultProps}
          expandedIds={new Set<string>(['root', 'folder-1'])}
          fileContentVisibleFolderIds={new Set<string>(['root'])}
        />
      </TestProvider>,
    )

    const secondRenderCalledIds = useListContentItemsQueryMock.mock.calls.map((args: unknown[]) => args[0])
    expect(secondRenderCalledIds).not.toContain('folder-1')

    useListContentItemsQueryMock.mockClear()

    rerender(
      <TestProvider>
        <DataroomSidebar
          {...defaultProps}
          expandedIds={new Set<string>(['root', 'folder-1'])}
          fileContentVisibleFolderIds={new Set<string>(['root', 'folder-1'])}
        />
      </TestProvider>,
    )

    const thirdRenderCalledIds = useListContentItemsQueryMock.mock.calls.map((args: unknown[]) => args[0])
    expect(thirdRenderCalledIds).toContain('folder-1')
  })

  it('hides expander for folders known to be empty', () => {
    useListContentItemsQueryMock.mockImplementation((folderId: string) => ({
      isPending: false,
      error: null,
      data: {
        folder: {
          id: folderId,
          name: folderId,
          parentId: folderId === 'root' ? 'root' : 'root',
        },
        breadcrumbs: [],
        items: [],
      },
    }))

    renderWithTheme(
      <DataroomSidebar
        {...defaultProps}
        knownFolderItemCounts={{
          'folder-1': 0,
        }}
      />,
    )

    const folderRow = screen.getByRole('button', { name: /folder 1/i })
    expect(folderRow.querySelector('.sidebar-tree-row__expander')).toBeNull()
  })
})
