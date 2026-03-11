import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContentItem } from '@/entities/content-item'
import type { PreviewPaneLayoutState } from '@/shared/lib/preview/use-preview-pane-layout'
import { TestProvider } from '@/shared/ui/test-provider'

import { PreviewPaneView } from './preview-pane-view'

const makeFile = (overrides: Partial<ContentItem> = {}): ContentItem => {
  const item: ContentItem = {
    id: 'file-1',
    kind: 'file',
    name: 'file.bin',
    parentId: null,
    childrenCount: 0,
    status: 'active',
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    mimeType: 'application/octet-stream',
    sizeBytes: 12,
    fileCount: null,
    importedAt: null,
    origin: null,
    googleFileId: null,
    ...overrides,
  }

  return {
    ...item,
    fileCount: overrides.fileCount ?? item.fileCount ?? null,
  }
}

const baseLayout: PreviewPaneLayoutState = {
  isRendered: true,
  isOpen: true,
  isResizing: false,
  displayPreviewItemId: 'file-1',
  isOpeningAnimationPending: false,
  canRenderHeavyPreview: true,
  paneClassName: 'preview-pane preview-pane--open',
  slidePanelClassName: 'preview-pane__slide-panel preview-pane__slide-panel--open',
  panelStyle: {},
  onResizeStart: () => undefined,
  onPaneTransitionEnd: () => undefined,
}

const renderWithTheme = (ui: ReactElement) => render(<TestProvider>{ui}</TestProvider>)

describe('PreviewPaneView', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('disables "Open" action for non-inline preview mime types', () => {
    renderWithTheme(
      <PreviewPaneView
        layout={baseLayout}
        currentItem={makeFile({ mimeType: 'application/zip', name: 'archive.zip' })}
        itemPending={false}
        itemError={null}
        currentContent={{ blob: new Blob(['zip'], { type: 'application/zip' }) }}
        contentPending={false}
        contentError={null}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled()
  })

  it('opens new tab for inline previewable files', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    renderWithTheme(
      <PreviewPaneView
        layout={baseLayout}
        currentItem={makeFile({ mimeType: 'image/png', name: 'image.png' })}
        itemPending={false}
        itemError={null}
        currentContent={{ blob: new Blob(['img'], { type: 'image/png' }) }}
        contentPending={false}
        contentError={null}
        onClose={() => undefined}
      />,
    )

    const openButton = screen.getByRole('button', { name: 'Open' })
    expect(openButton).toBeEnabled()

    fireEvent.click(openButton)

    expect(openSpy).toHaveBeenCalledWith('blob:preview-test', '_blank', 'noopener,noreferrer')
  })
})
