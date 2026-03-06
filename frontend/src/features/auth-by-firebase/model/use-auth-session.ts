import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'

import { firebaseAuth } from './firebase-client'

export type AuthSession = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
  getIdToken: () => Promise<string | null>
}

const googleProvider = new GoogleAuthProvider()

export const useAuthSession = (): AuthSession => {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(firebaseAuth, googleProvider)
  }, [])

  const signOutUser = useCallback(async () => {
    await signOut(firebaseAuth)
  }, [])

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const active = firebaseAuth.currentUser
    if (!active) {
      return null
    }
    return active.getIdToken()
  }, [])

  return useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signOutUser,
      getIdToken,
    }),
    [getIdToken, loading, signInWithGoogle, signOutUser, user],
  )
}
