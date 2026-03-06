import { IconChevronRight, IconDots } from '@tabler/icons-react'

import type { Breadcrumb } from '@/entities/folder'
import { Box, Group, Menu, Text } from '@/shared/ui'

type BreadcrumbsBarProps = {
  breadcrumbs: Breadcrumb[]
  onNavigate: (folderId: string) => void
}

const COLLAPSE_THRESHOLD = 5

export const BreadcrumbsBar = ({ breadcrumbs, onNavigate }: BreadcrumbsBarProps) => {
  const shouldCollapse = breadcrumbs.length >= COLLAPSE_THRESHOLD
  const start = breadcrumbs[0]
  const end = shouldCollapse ? breadcrumbs.slice(-2) : breadcrumbs.slice(1)
  const hidden = shouldCollapse ? breadcrumbs.slice(1, -2) : []

  return (
    <Group px="md" py="xs" gap={6} wrap="nowrap">
      {start ? (
        <Text size="sm" fw={600} style={{ cursor: 'pointer' }} onClick={() => onNavigate(start.id)}>
          {start.name}
        </Text>
      ) : null}

      {shouldCollapse ? (
        <>
          <IconChevronRight size={14} color="#7e8798" />
          <Menu withinPortal>
            <Menu.Target>
              <Box style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <IconDots size={16} color="#4a5161" />
              </Box>
            </Menu.Target>
            <Menu.Dropdown>
              {hidden.map((crumb) => (
                <Menu.Item key={crumb.id} onClick={() => onNavigate(crumb.id)}>
                  {crumb.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </>
      ) : null}

      {end.map((crumb) => (
        <Group gap={6} key={crumb.id} wrap="nowrap">
          <IconChevronRight size={14} color="#7e8798" />
          <Text size="sm" style={{ cursor: 'pointer' }} onClick={() => onNavigate(crumb.id)}>
            {crumb.name}
          </Text>
        </Group>
      ))}
    </Group>
  )
}
