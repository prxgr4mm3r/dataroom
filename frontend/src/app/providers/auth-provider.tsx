import { useEffect, type PropsWithChildren } from 'react'

import { useAuthSession } from '@/features/auth-by-firebase'
import { setAccessTokenGetter } from '@/shared/api'

import { AuthContext } from './auth-context'

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const session = useAuthSession()

  useEffect(() => {
    setAccessTokenGetter(session.getIdToken)
  }, [session.getIdToken])

  return (
    <AuthContext.Provider
      value={{
        ...session,
        isAuthenticated: Boolean(session.user),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
