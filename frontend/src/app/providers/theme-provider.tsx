import { MantineProvider, createTheme, localStorageColorSchemeManager } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import type { PropsWithChildren } from 'react'

const theme = createTheme({
  primaryColor: 'gray',
  fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
  defaultRadius: 'md',
})

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'dataroom-color-scheme',
})

export const ThemeProvider = ({ children }: PropsWithChildren) => (
  <MantineProvider theme={theme} colorSchemeManager={colorSchemeManager} defaultColorScheme="auto">
    <Notifications />
    {children}
  </MantineProvider>
)
