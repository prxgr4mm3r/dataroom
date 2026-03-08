import { IconMoonStars, IconSearch, IconSun } from '@tabler/icons-react'
import type { DragEvent } from 'react'

import type { Breadcrumb } from '@/entities/folder'
import { t } from '@/shared/i18n/messages'
import { ActionIcon, Box, Group, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@/shared/ui'
import { BreadcrumbsBar } from '@/widgets/breadcrumbs-bar'
import './dataroom-toolbar.css'

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
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'
  const toggleThemeLabel = isDark ? t('switchToLightTheme') : t('switchToDarkTheme')

  return (
    <Group justify="space-between" align="center" px="md" py="sm" wrap="nowrap" gap="md">
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
        <Tooltip label="Search files and folders">
          <ActionIcon
            variant="default"
            size="lg"
            radius="md"
            className="dataroom-toolbar__search"
            aria-label="Search files and folders"
            onClick={onOpenSearch}
          >
            <IconSearch size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={toggleThemeLabel}>
          <ActionIcon
            variant="default"
            size="lg"
            radius="md"
            className={[
              'dataroom-toolbar__theme-toggle',
              isDark ? 'dataroom-toolbar__theme-toggle--sun' : 'dataroom-toolbar__theme-toggle--moon',
            ].join(' ')}
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
