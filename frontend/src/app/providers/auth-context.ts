import { createContext } from 'react'

import type { AuthSession } from '@/features/auth-by-firebase'

export type AuthContextValue = AuthSession & {
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
