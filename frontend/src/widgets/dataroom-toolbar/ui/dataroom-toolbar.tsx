import { IconFolderPlus, IconUpload } from '@tabler/icons-react'

import type { Breadcrumb } from '@/entities/folder'
import { t } from '@/shared/i18n/messages'
import { Box, Button, Group } from '@/shared/ui'
import { BreadcrumbsBar } from '@/widgets/breadcrumbs-bar'

type DataroomToolbarProps = {
  breadcrumbs: Breadcrumb[]
  onNavigate: (folderId: string) => void
  onImportFile: () => void
  onNewFolder: () => void
}

export const DataroomToolbar = ({
  breadcrumbs,
  onNavigate,
  onImportFile,
  onNewFolder,
}: DataroomToolbarProps) => (
  <Group justify="space-between" align="center" px="md" py="sm" wrap="nowrap" gap="md">
    <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
      <BreadcrumbsBar breadcrumbs={breadcrumbs} onNavigate={onNavigate} compact />
    </Box>

    <Group gap="xs">
      <Button variant="default" leftSection={<IconFolderPlus size={16} />} onClick={onNewFolder}>
        {t('newFolder')}
      </Button>
      <Button leftSection={<IconUpload size={16} />} onClick={onImportFile}>
        {t('importFile')}
      </Button>
    </Group>
  </Group>
)
