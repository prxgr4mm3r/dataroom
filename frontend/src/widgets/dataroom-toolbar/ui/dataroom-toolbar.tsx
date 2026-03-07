import { IconMoonStars, IconSun } from '@tabler/icons-react'

import type { Breadcrumb } from '@/entities/folder'
import { t } from '@/shared/i18n/messages'
import { ActionIcon, Box, Group, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@/shared/ui'
import { BreadcrumbsBar } from '@/widgets/breadcrumbs-bar'
import './dataroom-toolbar.css'

type DataroomToolbarProps = {
  breadcrumbs: Breadcrumb[]
  onNavigate: (folderId: string) => void
}

export const DataroomToolbar = ({
  breadcrumbs,
  onNavigate,
}: DataroomToolbarProps) => {
  const { setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computedColorScheme === 'dark'
  const toggleThemeLabel = isDark ? t('switchToLightTheme') : t('switchToDarkTheme')

  return (
    <Group justify="space-between" align="center" px="md" py="sm" wrap="nowrap" gap="md">
      <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
        <BreadcrumbsBar breadcrumbs={breadcrumbs} onNavigate={onNavigate} compact />
      </Box>

      <Group gap="xs">
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
