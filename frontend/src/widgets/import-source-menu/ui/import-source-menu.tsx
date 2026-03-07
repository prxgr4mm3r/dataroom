import { IconUpload } from '@tabler/icons-react'
import type { ReactElement } from 'react'

import { t } from '@/shared/i18n/messages'
import { Menu } from '@/shared/ui'

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
}: ImportSourceMenuProps) => (
  <Menu withinPortal position={position} offset={offset}>
    <Menu.Target>{children}</Menu.Target>
    <Menu.Dropdown>
      <Menu.Item leftSection={<GoogleDriveLogo />} onClick={onImportFromGoogle}>
        {t('importFromGoogle')}
      </Menu.Item>
      <Menu.Item leftSection={<IconUpload size={14} />} onClick={onImportFromComputer}>
        {t('uploadFromComputer')}
      </Menu.Item>
    </Menu.Dropdown>
  </Menu>
)
