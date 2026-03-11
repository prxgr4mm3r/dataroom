import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { t } from '@/shared/i18n/messages'
import { ActionIcon } from '@/shared/ui'

type AppShellProps = {
  sidebar: ReactNode
  collapsedSidebar?: ReactNode
  header: ReactNode
  content: ReactNode
  bulkActions?: ReactNode
}

const DEFAULT_SIDEBAR_WIDTH = 260
const COLLAPSED_RAIL_WIDTH = 48
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 460

const clampSidebarWidth = (value: number) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value))
const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export const AppShell = ({ sidebar, collapsedSidebar, header, content, bulkActions }: AppShellProps) => {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStartRef.current || isSidebarCollapsed) {
        return
      }

      const deltaX = event.clientX - dragStartRef.current.startX
      const nextWidth = clampSidebarWidth(dragStartRef.current.startWidth + deltaX)
      setSidebarWidth(nextWidth)
    }

    const stopResizing = () => {
      setIsResizing(false)
      dragStartRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }
  }, [isResizing, isSidebarCollapsed])

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isSidebarCollapsed || event.button !== 0) {
      return
    }

    event.preventDefault()
    dragStartRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    }
    setIsResizing(true)
  }

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev)
  }

  const toggleLabel = isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')
  const sidebarColumnWidth = isSidebarCollapsed ? COLLAPSED_RAIL_WIDTH : sidebarWidth
  const toggleLeft = isSidebarCollapsed ? 6 : Math.max(6, sidebarColumnWidth - 46)
  const hasCollapsedSidebar = Boolean(collapsedSidebar)
  const hasBulkActions = Boolean(bulkActions)

  return (
    <div className="h-screen p-0">
      <div
        className={cx(
          'relative grid h-full overflow-hidden bg-[var(--bg-surface)]',
          '[--sidebar-width:260px]',
          '[grid-template-columns:var(--sidebar-width)_minmax(0,1fr)]',
          '[grid-template-rows:auto_minmax(0,1fr)]',
          'transition-[grid-template-columns] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)]',
          'motion-reduce:transition-none',
          'max-[980px]:[--sidebar-width:220px]',
          hasBulkActions && '[grid-template-rows:auto_minmax(0,1fr)_auto]',
          isResizing && 'select-none cursor-col-resize transition-none [&_*]:!cursor-col-resize',
        )}
        style={{ '--sidebar-width': `${sidebarColumnWidth}px` } as CSSProperties}
      >
        <div
          className={cx(
            'absolute top-3 z-[35]',
            isResizing
              ? 'transition-none'
              : 'transition-[left] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
          )}
          style={{ left: `${toggleLeft}px` }}
        >
          <ActionIcon
            className={cx(
              'min-h-9 min-w-9 rounded-[10px] text-[var(--icon-muted)]',
              'hover:bg-[var(--bg-hover-soft)]',
              'transition-colors duration-[120ms] ease-[ease]',
            )}
            variant="subtle"
            size="lg"
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={handleToggleSidebar}
          >
            {isSidebarCollapsed ? <IconLayoutSidebarLeftExpand size={18} /> : <IconLayoutSidebarLeftCollapse size={18} />}
          </ActionIcon>
        </div>

        {!isSidebarCollapsed ? (
          <div
            className={cx(
              'absolute top-0 bottom-0 z-[25] w-3 -translate-x-1/2 cursor-col-resize',
              "after:pointer-events-none after:absolute after:top-0 after:bottom-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:content-['']",
              'after:bg-transparent after:transition-colors after:duration-[120ms] after:ease-[ease]',
              'hover:after:bg-[var(--border-soft)]',
            )}
            style={{ left: `${sidebarWidth}px` }}
            onPointerDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('resizeSidebar')}
          />
        ) : null}

        <aside
          className={cx(
            'relative col-[1] row-[1/span_2] min-w-0 overflow-hidden bg-[var(--bg-sidebar)]',
            hasBulkActions && 'row-[1/span_3]',
          )}
        >
          {hasCollapsedSidebar ? (
            <>
              <div
                className={cx(
                  'absolute inset-0 will-change-[opacity,transform] motion-reduce:transition-none',
                  'transition-[opacity,transform] [transition-duration:200ms,220ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]',
                  isSidebarCollapsed ? 'pointer-events-none opacity-0 -translate-x-2' : 'pointer-events-auto opacity-100 translate-x-0',
                )}
                aria-hidden={isSidebarCollapsed}
              >
                {sidebar}
              </div>
              <div
                className={cx(
                  'absolute inset-0 will-change-[opacity,transform] motion-reduce:transition-none',
                  'transition-[opacity,transform] [transition-duration:200ms,220ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]',
                  isSidebarCollapsed ? 'pointer-events-auto opacity-100 translate-x-0' : 'pointer-events-none opacity-0 translate-x-2',
                )}
                aria-hidden={!isSidebarCollapsed}
              >
                {collapsedSidebar}
              </div>
            </>
          ) : (
            sidebar
          )}
        </aside>
        <header
          className={cx(
            'relative col-[2] row-[1]',
            "after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:content-['']",
            'after:bg-[var(--separator-soft)]',
          )}
        >
          {header}
        </header>
        <main className="col-[2] row-[2] min-h-0 min-w-0 overflow-hidden">{content}</main>
        {hasBulkActions ? <footer className="relative col-[2] row-[3] min-h-14">{bulkActions}</footer> : null}
      </div>
    </div>
  )
}
