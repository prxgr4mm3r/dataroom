import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { IconMail } from '@tabler/icons-react'

import { Alert, Button, Center, Group, Loader, Paper, Stack, Text, TextInput, Title } from '@/shared/ui'
import { t } from '@/shared/i18n/messages'
import { isAuthError, toApiError } from '@/shared/api'
import { useCurrentUserQuery } from '@/features/load-current-user'
import { useAuth } from '@/app/providers'
import { routes } from '@/shared/config/routes'
import { DataroomPage } from '@/pages/dataroom-page'
import { OAuthCallbackPage } from '@/pages/oauth-callback-page'
import { SharedViewPage } from '@/pages/shared-view-page'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import './styles/auth-screen.css'

type SignInPhase = 'idle' | 'google' | 'sending_link' | 'completing_link'

const GoogleBrandIcon = () => (
  <svg className="auth-google-icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path
      d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.843 2.0782-1.7968 2.7173v2.2582h2.908c1.7018-1.5668 2.6832-3.8741 2.6832-6.6164z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.4673-.8055 5.9564-2.1791l-2.9082-2.2582c-.8055.54-1.8368.8591-3.0482.8591-2.3441 0-4.3282-1.5832-5.0373-3.7091H.9573v2.3327A8.997 8.997 0 009 18z"
      fill="#34A853"
    />
    <path
      d="M3.9627 10.7127A5.41 5.41 0 013.68 9c0-.5945.1023-1.1727.2827-1.7127V4.9545H.9573A8.997 8.997 0 000 9c0 1.4523.3482 2.8273.9573 4.0455l3.0054-2.3328z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.5795c1.3214 0 2.5082.4541 3.4445 1.3459l2.5814-2.5814C13.4636.8918 11.4264 0 9 0 5.4886 0 2.4418 2.0177.9573 4.9545l3.0054 2.3328C4.6718 5.1614 6.6559 3.5795 9 3.5795z"
      fill="#EA4335"
    />
  </svg>
)

const getAuthActionErrorMessage = (error: unknown): string => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: string }).code === 'string'
  ) {
    const code = (error as { code: string }).code
    switch (code) {
      case 'auth/invalid-email':
        return t('authErrorInvalidEmail')
      case 'auth/user-disabled':
        return t('authErrorUserDisabled')
      case 'auth/too-many-requests':
        return t('authErrorTooManyRequests')
      case 'auth/popup-blocked':
        return t('authErrorPopupBlocked')
      case 'auth/popup-closed-by-user':
        return t('authErrorPopupClosed')
      case 'auth/network-request-failed':
        return t('authErrorNetworkFailed')
      case 'auth/unauthorized-domain':
        return t('authErrorUnauthorizedDomain')
      default:
        break
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return t('authGenericError')
}

const AuthLoadingScreen = ({ label }: { label: string }) => (
  <Center className="auth-screen auth-screen--loading">
    <Paper withBorder shadow="md" radius="lg" p="xl" className="auth-card auth-card--loading">
      <Stack align="center" gap="sm">
        <Loader type="dots" size="lg" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Paper>
  </Center>
)

const SignInScreen = () => {
  const { signInWithGoogle, sendMagicLink, completeMagicLinkSignIn, isMagicLinkSignIn } = useAuth()
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<SignInPhase>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isMagicLinkSignIn()) {
      return
    }

    const runMagicLinkCompletion = async () => {
      setPhase('completing_link')
      setErrorMessage(null)
      setStatusMessage(t('magicLinkOpen'))

      try {
        const result = await completeMagicLinkSignIn()
        if (result !== 'completed') {
          setPhase('idle')
          setStatusMessage(null)
        }
      } catch (error) {
        setPhase('idle')
        setStatusMessage(null)
        setErrorMessage(getAuthActionErrorMessage(error))
      }
    }

    void runMagicLinkCompletion()
  }, [completeMagicLinkSignIn, isMagicLinkSignIn])

  const handleGoogleSignIn = async () => {
    setPhase('google')
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const result = await signInWithGoogle()
      if (result.status === 'magic_link_sent') {
        setPhase('idle')
        setEmail(result.email)
        setStatusMessage(`${t('magicLinkSent')} — ${result.email}`)
      }
    } catch (error) {
      setPhase('idle')
      setErrorMessage(getAuthActionErrorMessage(error))
    }
  }

  const handleMagicLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!email.trim()) {
      setErrorMessage(t('authErrorInvalidEmail'))
      return
    }

    setPhase('sending_link')
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await sendMagicLink(email)
      setPhase('idle')
      setStatusMessage(t('magicLinkSentHint'))
    } catch (error) {
      setPhase('idle')
      setErrorMessage(getAuthActionErrorMessage(error))
    }
  }

  const handleLegalLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
  }

  const overlayLabel = useMemo(() => {
    if (phase === 'google') {
      return t('authLoaderGoogle')
    }
    if (phase === 'sending_link') {
      return t('authLoaderSendingLink')
    }
    if (phase === 'completing_link') {
      return t('authLoaderCheckingLink')
    }
    return null
  }, [phase])
  const isBusy = Boolean(overlayLabel)
  const statusTitle = t('magicLinkSent')

  return (
    <Center className="auth-screen">
      <Stack gap="md" className="auth-shell">
        <Title order={2} className="auth-hero-title">
          {t('signInHeroTitle')}
        </Title>

        <Paper withBorder shadow="md" p="lg" maw={430} w="100%" radius="lg" className="auth-card">
          <Stack gap="lg">
            <Stack gap={4} className="auth-brand">
              <Title order={3} className="auth-card-title">
                {t('signInCardTitle')}
              </Title>
              <Text size="sm" c="dimmed">
                {t('signInSubtitle')}
              </Text>
            </Stack>

            {errorMessage ? (
              <Alert color="red" title={t('authenticationFailed')}>
                <Text size="sm">{errorMessage}</Text>
              </Alert>
            ) : null}

            {statusMessage ? (
              <Alert color="blue" title={statusTitle}>
                <Text size="sm">{statusMessage}</Text>
              </Alert>
            ) : null}

            <Button
              fullWidth
              size="md"
              onClick={() => void handleGoogleSignIn()}
              leftSection={<GoogleBrandIcon />}
              className="auth-google-button"
              disabled={isBusy}
            >
              {t('signInWithGoogle')}
            </Button>

            <div className="auth-email-divider" role="separator" aria-label={t('signInWithEmail')}>
              <span>{t('signInWithEmail')}</span>
            </div>

            <form onSubmit={(event) => void handleMagicLinkSubmit(event)}>
              <Stack gap="sm">
                <TextInput
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  label={t('emailAddressLabel')}
                  placeholder={t('emailAddressPlaceholder')}
                  autoComplete="email"
                  type="email"
                  required
                  disabled={isBusy}
                />
                <Button
                  fullWidth
                  size="md"
                  variant="light"
                  type="submit"
                  leftSection={<IconMail size={18} />}
                  className="auth-email-button"
                  disabled={isBusy}
                >
                  {t('sendMagicLink')}
                </Button>
              </Stack>
            </form>
          </Stack>

          {overlayLabel ? (
            <div className="auth-overlay">
              <Stack align="center" gap="xs">
                <Loader type="dots" size="sm" />
                <Text size="sm">{overlayLabel}</Text>
              </Stack>
            </div>
          ) : null}
        </Paper>

        <Group gap="sm" justify="center" className="auth-legal">
          <a href="#" onClick={handleLegalLinkClick} className="auth-legal-link">
            {t('terms')}
          </a>
          <Text c="dimmed" size="xs">
            •
          </Text>
          <a href="#" onClick={handleLegalLinkClick} className="auth-legal-link">
            {t('privacy')}
          </a>
        </Group>

        <Stack gap={2} className="auth-disclaimer">
          <Text size="xs">{t('demoLicenseNotice')}</Text>
          <Text size="xs">{t('demoAuthorNotice')}</Text>
        </Stack>
      </Stack>
    </Center>
  )
}

const RequireAuth = () => {
  const { loading, isAuthenticated, signOutUser } = useAuth()
  const meQuery = useCurrentUserQuery(isAuthenticated)
  const navigate = useNavigate()
  const location = useLocation()
  const initialRouteNormalizedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) {
      initialRouteNormalizedRef.current = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (loading || !isAuthenticated || meQuery.isPending || meQuery.error || !meQuery.data) {
      return
    }

    if (initialRouteNormalizedRef.current) {
      return
    }

    initialRouteNormalizedRef.current = true

    const atRootRoute = location.pathname === routes.dataroomRoot
    const hasExtraUrlState = Boolean(location.search || location.hash)

    if (!atRootRoute || hasExtraUrlState) {
      navigate(routes.dataroomRoot, { replace: true })
    }
  }, [
    isAuthenticated,
    loading,
    location.hash,
    location.pathname,
    location.search,
    meQuery.data,
    meQuery.error,
    meQuery.isPending,
    navigate,
  ])

  const handleSignOut = () => {
    navigate(routes.dataroomRoot, { replace: true })
    void signOutUser()
  }

  if (loading) {
    return <AuthLoadingScreen label={t('authLoaderPreparing')} />
  }

  if (!isAuthenticated) {
    return <SignInScreen />
  }

  if (meQuery.isPending) {
    return <AuthLoadingScreen label={t('authLoaderPreparing')} />
  }

  if (meQuery.error) {
    const apiError = toApiError(meQuery.error)
    const authError = isAuthError(apiError)

    return (
      <Center mih="100vh" p="md">
        <Paper withBorder p="lg" maw={560} w="100%">
          <Stack>
            <Alert color={authError ? 'yellow' : 'red'} title={authError ? 'Session restore failed' : 'Authentication failed'}>
              <Text size="sm">
                {authError
                  ? 'We could not restore your session automatically. Please try again.'
                  : apiError.message}
              </Text>
              {authError ? (
                <Text c="dimmed" mt="xs" size="xs">
                  {apiError.message}
                </Text>
              ) : null}
            </Alert>
            <Group grow>
              <Button onClick={() => void meQuery.refetch()} loading={meQuery.isRefetching}>
                Try again
              </Button>
              <Button variant="light" onClick={handleSignOut}>
                Sign out
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Center>
    )
  }

  return <DataroomPage currentUser={meQuery.data} />
}

export const App = () => (
  <Routes>
    <Route path={routes.oauthCallback} element={<OAuthCallbackPage />} />
    <Route path={routes.shareView} element={<SharedViewPage />} />
    <Route path={routes.dataroomRoot} element={<RequireAuth />} />
    <Route path={routes.dataroomFolder} element={<RequireAuth />} />
    <Route path="*" element={<Navigate to={routes.dataroomRoot} replace />} />
  </Routes>
)
