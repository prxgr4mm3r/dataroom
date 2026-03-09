import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  isSignInWithEmailLink,
  linkWithCredential,
  onIdTokenChanged,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type AuthError,
  type OAuthCredential,
  type User,
} from 'firebase/auth'

import { apiClient, toApiError } from '@/shared/api'
import { routes } from '@/shared/config/routes'

import { firebaseAuth } from './firebase-client'

export type CompleteMagicLinkResult = 'completed' | 'not_magic_link'
export type GoogleSignInResult =
  | { status: 'signed_in' }
  | { status: 'magic_link_sent'; email: string }

export type AuthSession = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<GoogleSignInResult>
  sendMagicLink: (email: string) => Promise<void>
  completeMagicLinkSignIn: (email?: string, url?: string) => Promise<CompleteMagicLinkResult>
  isMagicLinkSignIn: (url?: string) => boolean
  signOutUser: () => Promise<void>
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>
}

const googleProvider = new GoogleAuthProvider()
const MAGIC_LINK_EMAIL_KEY = 'dataroom.auth.magic_link_email'
const PENDING_GOOGLE_CREDENTIAL_KEY = 'dataroom.auth.pending_google_credential'
const DATAROOM_QUERY_KEY = ['dataroom'] as const

type StoredGoogleCredential = {
  email: string
  idToken: string | null
  accessToken: string | null
}

const isClient = (): boolean => typeof window !== 'undefined'

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const setStoredMagicLinkEmail = (email: string): void => {
  if (!isClient()) {
    return
  }
  window.localStorage.setItem(MAGIC_LINK_EMAIL_KEY, normalizeEmail(email))
}

const getStoredMagicLinkEmail = (): string | null => {
  if (!isClient()) {
    return null
  }
  const value = window.localStorage.getItem(MAGIC_LINK_EMAIL_KEY)
  if (!value) {
    return null
  }
  return normalizeEmail(value)
}

const clearStoredMagicLinkEmail = (): void => {
  if (!isClient()) {
    return
  }
  window.localStorage.removeItem(MAGIC_LINK_EMAIL_KEY)
}

const setPendingGoogleCredential = (email: string, credential: OAuthCredential): void => {
  if (!isClient()) {
    return
  }

  const payload: StoredGoogleCredential = {
    email: normalizeEmail(email),
    idToken: credential.idToken ?? null,
    accessToken: credential.accessToken ?? null,
  }

  window.localStorage.setItem(PENDING_GOOGLE_CREDENTIAL_KEY, JSON.stringify(payload))
}

const getPendingGoogleCredential = (): StoredGoogleCredential | null => {
  if (!isClient()) {
    return null
  }

  const raw = window.localStorage.getItem(PENDING_GOOGLE_CREDENTIAL_KEY)
  if (!raw) {
    return null
  }

  try {
    const payload = JSON.parse(raw) as StoredGoogleCredential
    if (!payload.email || (!payload.idToken && !payload.accessToken)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

const clearPendingGoogleCredential = (): void => {
  if (!isClient()) {
    return
  }
  window.localStorage.removeItem(PENDING_GOOGLE_CREDENTIAL_KEY)
}

const isAuthErrorCode = (error: unknown, code: string): error is AuthError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  )
}

const stripMagicLinkParamsFromUrl = (): void => {
  if (!isClient()) {
    return
  }

  const cleanUrl = new URL(window.location.href)
  cleanUrl.search = ''
  cleanUrl.hash = ''
  cleanUrl.pathname = routes.dataroomRoot
  window.history.replaceState({}, document.title, cleanUrl.toString())
}

export const useAuthSession = (): AuthSession => {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const sendMagicLink = useCallback(async (email: string) => {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) {
      throw new Error('Email is required for magic link sign-in.')
    }

    try {
      await apiClient.post('/api/auth/magic-link', {
        email: normalizedEmail,
      })
      setStoredMagicLinkEmail(normalizedEmail)
    } catch (error) {
      throw new Error(toApiError(error).message)
    }
  }, [])

  const signInWithGoogle = useCallback(async (): Promise<GoogleSignInResult> => {
    try {
      await signInWithPopup(firebaseAuth, googleProvider)
      clearPendingGoogleCredential()
      return { status: 'signed_in' }
    } catch (error) {
      if (!isAuthErrorCode(error, 'auth/account-exists-with-different-credential')) {
        throw error
      }

      const email = normalizeEmail(error.customData?.email ?? '')
      const pendingCredential = GoogleAuthProvider.credentialFromError(error)
      if (!email || !pendingCredential) {
        throw error
      }

      const methods = await fetchSignInMethodsForEmail(firebaseAuth, email)
      if (!methods.includes(EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD)) {
        throw error
      }

      setPendingGoogleCredential(email, pendingCredential)
      await sendMagicLink(email)
      return { status: 'magic_link_sent', email }
    }
  }, [sendMagicLink])

  const isMagicLinkSignIn = useCallback((url?: string): boolean => {
    const candidateUrl = url ?? (isClient() ? window.location.href : '')
    if (!candidateUrl) {
      return false
    }

    return isSignInWithEmailLink(firebaseAuth, candidateUrl)
  }, [])

  const completeMagicLinkSignIn = useCallback(
    async (email?: string, url?: string): Promise<CompleteMagicLinkResult> => {
      const candidateUrl = url ?? (isClient() ? window.location.href : '')
      if (!candidateUrl || !isSignInWithEmailLink(firebaseAuth, candidateUrl)) {
        return 'not_magic_link'
      }

      const normalizedEmail = normalizeEmail(email ?? getStoredMagicLinkEmail() ?? '')
      if (!normalizedEmail) {
        clearPendingGoogleCredential()
        stripMagicLinkParamsFromUrl()
        return 'not_magic_link'
      }

      await signInWithEmailLink(firebaseAuth, normalizedEmail, candidateUrl)
      clearStoredMagicLinkEmail()

      const pendingGoogleCredential = getPendingGoogleCredential()
      if (pendingGoogleCredential && pendingGoogleCredential.email === normalizedEmail) {
        const current = firebaseAuth.currentUser
        const credential = GoogleAuthProvider.credential(
          pendingGoogleCredential.idToken,
          pendingGoogleCredential.accessToken,
        )

        if (current && (pendingGoogleCredential.idToken || pendingGoogleCredential.accessToken)) {
          try {
            await linkWithCredential(current, credential)
          } catch (linkError) {
            if (
              !isAuthErrorCode(linkError, 'auth/provider-already-linked') &&
              !isAuthErrorCode(linkError, 'auth/credential-already-in-use')
            ) {
              throw linkError
            }
          } finally {
            clearPendingGoogleCredential()
          }
        } else {
          clearPendingGoogleCredential()
        }
      } else if (pendingGoogleCredential) {
        clearPendingGoogleCredential()
      }

      stripMagicLinkParamsFromUrl()
      return 'completed'
    },
    [],
  )

  const signOutUser = useCallback(async () => {
    clearPendingGoogleCredential()
    clearStoredMagicLinkEmail()
    await signOut(firebaseAuth)
    await queryClient.cancelQueries({ queryKey: DATAROOM_QUERY_KEY })
    queryClient.removeQueries({ queryKey: DATAROOM_QUERY_KEY })
  }, [queryClient])

  const getIdToken = useCallback(async (forceRefresh?: boolean): Promise<string | null> => {
    const active = firebaseAuth.currentUser
    if (!active) {
      return null
    }
    return active.getIdToken(Boolean(forceRefresh))
  }, [])

  useEffect(() => {
    const refreshTokenOnWake = () => {
      if (document.visibilityState === 'hidden') {
        return
      }

      void getIdToken()
    }

    window.addEventListener('focus', refreshTokenOnWake)
    document.addEventListener('visibilitychange', refreshTokenOnWake)

    return () => {
      window.removeEventListener('focus', refreshTokenOnWake)
      document.removeEventListener('visibilitychange', refreshTokenOnWake)
    }
  }, [getIdToken])

  return useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      sendMagicLink,
      completeMagicLinkSignIn,
      isMagicLinkSignIn,
      signOutUser,
      getIdToken,
    }),
    [
      completeMagicLinkSignIn,
      getIdToken,
      isMagicLinkSignIn,
      loading,
      sendMagicLink,
      signInWithGoogle,
      signOutUser,
      user,
    ],
  )
}
