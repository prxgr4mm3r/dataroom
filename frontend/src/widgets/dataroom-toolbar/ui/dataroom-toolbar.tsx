import { IconMoonStars, IconSearch, IconSun } from '@tabler/icons-react'
import { useLayoutEffect, useRef, useState, type DragEvent } from 'react'

import type { Breadcrumb } from '@/entities/folder'
import { t } from '@/shared/i18n/messages'
import { APP_SHORTCUTS, withShortcutHint } from '@/shared/lib/keyboard/shortcuts'
import { ActionIcon, Box, Group, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@/shared/ui'
import { BreadcrumbsBar } from '@/widgets/breadcrumbs-bar'

type DropState = 'none' | 'valid' | 'warning' | 'invalid'

type CurrentFolderMenuHandlers = {
  onCreateFolder?: (folder: Breadcrumb) => void
  onDownload?: (folder: Breadcrumb) => void
  onCopy?: (folder: Breadcrumb) => void
  onShare?: (folder: Breadcrumb) => void
  onRename?: (folder: Breadcrumb) => void
  onMove?: (folder: Breadcrumb) => void
  onDelete?: (folder: Breadcrumb) => void
}

type DataroomToolbarProps = {
  breadcrumbs: Breadcrumb[]
  onNavigate: (folderId: string) => void
  onOpenSearch?: () => void
  currentFolderMenu?: CurrentFolderMenuHandlers
  onFolderDragOver?: (folderId: string, event: DragEvent<HTMLElement>) => void
  onFolderDragLeave?: (folderId: string) => void
  onFolderDrop?: (folderId: string, event: DragEvent<HTMLElement>) => void
  getFolderDropState?: (folderId: string) => DropState
}

const DATAROOM_TOOLBAR_COMPACT_SEARCH_MIN_WIDTH = 400

export const DataroomToolbar = ({
  breadcrumbs,
  onNavigate,
  onOpenSearch,
  currentFolderMenu,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  getFolderDropState,
}: DataroomToolbarProps) => {
  const { setColorScheme } = useMantineColorScheme()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarWidth, setToolbarWidth] = useState(0)
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'
  const toggleThemeLabel = isDark ? t('switchToLightTheme') : t('switchToDarkTheme')
  const searchLabel = 'Search files and folders'
  const searchLabelWithShortcut = withShortcutHint(searchLabel, APP_SHORTCUTS.openSearch.label)
  const searchButtonClassName =
    'inline-flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-[10px] border border-[var(--table-separator)] bg-[var(--bg-subtle)] px-[14px] font-inherit text-[var(--text-secondary)] enabled:cursor-pointer enabled:hover:border-[var(--accent)] enabled:hover:text-[var(--accent)] disabled:cursor-default disabled:opacity-60'
  const themeToggleClassName = isDark
    ? 'border border-[#c7d8f3] bg-[#f4f8ff] text-[#223a5c] hover:bg-[#eaf1ff]'
    : 'border border-[#344b66] bg-[#1b2a3d] text-[#dbe7f7] hover:bg-[#24364d]'
  const showCompactSearchButton = toolbarWidth > 0 && toolbarWidth < DATAROOM_TOOLBAR_COMPACT_SEARCH_MIN_WIDTH

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) {
      return
    }

    const updateWidth = () => {
      setToolbarWidth(Math.round(toolbar.getBoundingClientRect().width))
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(toolbar)
    window.addEventListener('resize', updateWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  return (
    <Group ref={toolbarRef} justify="space-between" align="center" px="md" py="sm" wrap="nowrap" gap="md">
      <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
        <BreadcrumbsBar
          breadcrumbs={breadcrumbs}
          onNavigate={onNavigate}
          compact
          currentFolderMenu={currentFolderMenu}
          onFolderDragOver={onFolderDragOver}
          onFolderDragLeave={onFolderDragLeave}
          onFolderDrop={onFolderDrop}
          getFolderDropState={getFolderDropState}
        />
      </Box>

      <Group gap="xs">
        <Tooltip label={searchLabelWithShortcut}>
          {showCompactSearchButton ? (
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              className="border border-[var(--table-separator)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] enabled:hover:border-[var(--accent)] enabled:hover:text-[var(--accent)] disabled:cursor-default disabled:opacity-60"
              aria-label={searchLabelWithShortcut}
              title={searchLabelWithShortcut}
              onClick={onOpenSearch}
              disabled={!onOpenSearch}
            >
              <IconSearch size={16} />
            </ActionIcon>
          ) : (
            <button
              type="button"
              className={searchButtonClassName}
              aria-label={searchLabelWithShortcut}
              title={searchLabelWithShortcut}
              onClick={onOpenSearch}
              disabled={!onOpenSearch}
            >
              <IconSearch size={16} />
              <span className="text-[13px] font-semibold">Search</span>
              <span className="text-[11px] text-[var(--text-muted)]">{APP_SHORTCUTS.openSearch.compactLabel}</span>
            </button>
          )}
        </Tooltip>
        <Tooltip label={toggleThemeLabel}>
          <ActionIcon
            variant="default"
            size="lg"
            radius="md"
            className={themeToggleClassName}
            aria-label={toggleThemeLabel}
            onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <IconSun size={17} /> : <IconMoonStars size={17} />}
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  )
}
