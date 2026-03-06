import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { t } from '@/shared/i18n/messages'
import { ActionIcon } from '@/shared/ui'
import './app-shell.css'

type AppShellProps = {
  sidebar: ReactNode
  collapsedSidebar?: ReactNode
  header: ReactNode
  content: ReactNode
  bulkActions: ReactNode
}

const DEFAULT_SIDEBAR_WIDTH = 260
const COLLAPSED_RAIL_WIDTH = 48
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 460

const clampSidebarWidth = (value: number) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value))

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
  const hasCollapsedSidebar = Boolean(collapsedSidebar)

  return (
    <div className="dataroom-shell">
      <div
        className={[
          'dataroom-shell__frame',
          isSidebarCollapsed ? 'dataroom-shell__frame--sidebar-collapsed' : '',
          isResizing ? 'dataroom-shell__frame--resizing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--sidebar-width': `${sidebarColumnWidth}px` } as CSSProperties}
      >
        <ActionIcon
          className={[
            'dataroom-shell__sidebar-toggle',
            isSidebarCollapsed ? 'dataroom-shell__sidebar-toggle--collapsed' : 'dataroom-shell__sidebar-toggle--expanded',
          ]
            .filter(Boolean)
            .join(' ')}
          variant="subtle"
          size="lg"
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={handleToggleSidebar}
        >
          {isSidebarCollapsed ? <IconLayoutSidebarLeftExpand size={18} /> : <IconLayoutSidebarLeftCollapse size={18} />}
        </ActionIcon>

        {!isSidebarCollapsed ? (
          <div
            className="dataroom-shell__sidebar-resizer"
            style={{ left: `${sidebarWidth}px` }}
            onPointerDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('resizeSidebar')}
          />
        ) : null}

        <aside className="dataroom-shell__sidebar">
          {hasCollapsedSidebar ? (
            <>
              <div
                className={[
                  'dataroom-shell__sidebar-layer',
                  'dataroom-shell__sidebar-layer--expanded',
                  isSidebarCollapsed ? 'dataroom-shell__sidebar-layer--hidden' : 'dataroom-shell__sidebar-layer--visible',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden={isSidebarCollapsed}
              >
                {sidebar}
              </div>
              <div
                className={[
                  'dataroom-shell__sidebar-layer',
                  'dataroom-shell__sidebar-layer--collapsed',
                  isSidebarCollapsed ? 'dataroom-shell__sidebar-layer--visible' : 'dataroom-shell__sidebar-layer--hidden',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden={!isSidebarCollapsed}
              >
                {collapsedSidebar}
              </div>
            </>
          ) : (
            sidebar
          )}
        </aside>
        <header className="dataroom-shell__header">{header}</header>
        <main className="dataroom-shell__body">{content}</main>
        <footer className="dataroom-shell__bulk">{bulkActions}</footer>
      </div>
    </div>
  )
}
