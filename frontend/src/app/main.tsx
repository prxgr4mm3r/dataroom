import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { App } from './App'
import { AppQueryClientProvider, AppRouterProvider, AuthProvider, ThemeProvider } from './providers'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppQueryClientProvider>
        <AuthProvider>
          <AppRouterProvider>
            <App />
          </AppRouterProvider>
        </AuthProvider>
      </AppQueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
