import { IconFolderPlus, IconUpload } from '@tabler/icons-react'

import type { UserProfile } from '@/entities/user'
import { t } from '@/shared/i18n/messages'
import { Button, Group, Text, Title } from '@/shared/ui'

type DataroomToolbarProps = {
  currentUser: UserProfile
  onImportFile: () => void
  onNewFolder: () => void
}

export const DataroomToolbar = ({
  currentUser,
  onImportFile,
  onNewFolder,
}: DataroomToolbarProps) => (
  <Group justify="space-between" px="md" py="sm">
    <div>
      <Title order={4}>{t('appTitle')}</Title>
      <Text size="sm" c="var(--text-secondary)">
        {currentUser.email || currentUser.displayName || currentUser.firebaseUid}
      </Text>
    </div>

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
