import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MiddleEllipsisText } from './file-table'

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('MiddleEllipsisText', () => {
  const originalResizeObserver = globalThis.ResizeObserver
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')

  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        if (this.getAttribute('data-testid') === 'middle-ellipsis-root') {
          return 18
        }
        return 0
      },
    })

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return this.textContent?.length ?? 0
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()

    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver
    } else {
      // @ts-expect-error restoring absent global
      delete globalThis.ResizeObserver
    }

    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
    }

    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
    }
  })

  it('renders a shortened value when content width exceeds available width', async () => {
    render(
      <MiddleEllipsisText
        text="wallet-recovery-0xc1e985ca72c165e64a1a6778e99aa6fa2b84c412ac049cf559b9a6a18ab9ba72-DO_NOT_DELETE"
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('middle-ellipsis-value').textContent).toContain('...')
    })
  })
})
