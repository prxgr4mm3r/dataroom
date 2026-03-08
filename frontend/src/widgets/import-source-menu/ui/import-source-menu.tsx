import { IconUpload } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { t } from '@/shared/i18n/messages'
import { APP_SHORTCUTS } from '@/shared/lib/keyboard/shortcuts'
import { Menu, Text } from '@/shared/ui'

type ImportSourceMenuProps = {
  onImportFromGoogle: () => void
  onImportFromComputer: () => void
  children: ReactElement
  position?: 'bottom-end' | 'right-start'
  offset?: number
}

const GOOGLE_DRIVE_LOGO_SRC = '/logo_drive.png'

const GoogleDriveLogo = () => (
  <img
    src={GOOGLE_DRIVE_LOGO_SRC}
    alt=""
    aria-hidden="true"
    width={14}
    height={12}
    style={{ objectFit: 'contain' }}
    draggable={false}
  />
)

export const ImportSourceMenu = ({
  onImportFromGoogle,
  onImportFromComputer,
  children,
  position = 'bottom-end',
  offset = 6,
}: ImportSourceMenuProps) => {
  const uploadFromComputerShortcutLabel = APP_SHORTCUTS.importFromComputer.compactLabel
  const importFromGoogleShortcutLabel = APP_SHORTCUTS.importFromGoogle.compactLabel

  return (
    <Menu withinPortal position={position} offset={offset}>
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<GoogleDriveLogo />}
          rightSection={<Text size="xs" c="dimmed">{importFromGoogleShortcutLabel}</Text>}
          onClick={onImportFromGoogle}
        >
          {t('importFromGoogle')}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconUpload size={14} />}
          rightSection={<Text size="xs" c="dimmed">{uploadFromComputerShortcutLabel}</Text>}
          onClick={onImportFromComputer}
        >
          {t('uploadFromComputer')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
