import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import type { PropsWithChildren } from 'react'

const theme = createTheme({
  primaryColor: 'gray',
  fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
  defaultRadius: 'md',
})

export const ThemeProvider = ({ children }: PropsWithChildren) => (
  <MantineProvider theme={theme} defaultColorScheme="light">
    <Notifications />
    {children}
  </MantineProvider>
)
