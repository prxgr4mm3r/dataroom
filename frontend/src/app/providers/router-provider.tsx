import { BrowserRouter } from 'react-router-dom'
import type { PropsWithChildren } from 'react'

export const AppRouterProvider = ({ children }: PropsWithChildren) => (
  <BrowserRouter>{children}</BrowserRouter>
)
