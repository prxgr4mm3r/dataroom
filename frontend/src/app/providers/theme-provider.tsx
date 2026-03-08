import { MantineProvider, createTheme, localStorageColorSchemeManager } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import type { PropsWithChildren } from 'react'

const theme = createTheme({
  primaryColor: 'blue',
  fontFamily: 'Manrope, system-ui, sans-serif',
  defaultRadius: 'md',
  components: {
    Modal: {
      defaultProps: {
        centered: true,
        closeButtonProps: {
          className: 'app-modal-close',
        },
      },
      styles: {
        overlay: {
          background: 'rgb(7 15 32 / 64%)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        },
        content: {
          border: '1px solid var(--border-muted)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-soft), 0 0 0 1px var(--table-row-hover-border)',
        },
        header: {
          background: 'var(--bg-subtle)',
          borderBottom: 'none',
        },
        body: {
          background: 'var(--bg-surface)',
        },
        title: {
          color: 'var(--text-primary)',
          fontSize: '1rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
        },
      },
    },
  },
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
