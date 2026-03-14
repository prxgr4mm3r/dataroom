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

type SignInPhase = 'idle' | 'google' | 'sending_link' | 'completing_link'

const AUTH_SCREEN_CLASS_NAME =
  "relative isolate min-h-screen w-full overflow-hidden bg-[linear-gradient(165deg,var(--bg-app-gradient-top)_0%,var(--bg-app-gradient-mid)_55%,var(--bg-app-gradient-bottom)_100%)] p-[clamp(20px,4vw,40px)] before:pointer-events-none before:absolute before:inset-[-16%_-12%] before:z-0 before:bg-[radial-gradient(42%_38%_at_14%_18%,rgb(56_189_248_/_20%),transparent_74%),radial-gradient(34%_32%_at_82%_20%,rgb(37_99_235_/_17%),transparent_72%),radial-gradient(46%_44%_at_66%_82%,rgb(14_165_233_/_14%),transparent_76%),radial-gradient(38%_34%_at_28%_76%,rgb(15_23_42_/_16%),transparent_74%)] before:content-[''] before:blur-[10px] after:pointer-events-none after:absolute after:inset-[-40%] after:z-0 after:rotate-[-10deg] after:bg-[conic-gradient(from_198deg_at_52%_46%,rgb(29_78_216_/_0%)_0deg,rgb(29_78_216_/_8%)_66deg,rgb(56_189_248_/_10%)_126deg,rgb(37_99_235_/_0%)_210deg,rgb(30_64_175_/_8%)_280deg,rgb(59_130_246_/_0%)_360deg)] after:opacity-50 after:content-[''] dark:before:bg-[radial-gradient(44%_40%_at_14%_18%,rgb(56_189_248_/_24%),transparent_75%),radial-gradient(36%_34%_at_82%_20%,rgb(37_99_235_/_22%),transparent_73%),radial-gradient(48%_46%_at_66%_82%,rgb(14_165_233_/_18%),transparent_77%),radial-gradient(40%_36%_at_28%_76%,rgb(15_23_42_/_26%),transparent_74%)] dark:after:opacity-[0.62]"
const AUTH_SHELL_CLASS_NAME = 'relative z-10 w-full max-w-[430px] items-stretch'
const AUTH_CARD_CLASS_NAME =
  'relative z-10 !border-[rgb(57_96_146_/_62%)] !bg-[rgb(12_29_54_/_86%)] shadow-[0_24px_60px_rgb(0_0_0_/_34%),0_10px_28px_rgb(3_12_28_/_28%)] backdrop-blur-[3px] max-[560px]:p-[22px]'
const AUTH_LOADING_CARD_CLASS_NAME = `${AUTH_CARD_CLASS_NAME} max-w-[320px]`
const AUTH_HERO_TITLE_CLASS_NAME =
  'm-0 self-center w-max text-center !text-[clamp(56px,7.2vw,72px)] !leading-[0.98] font-medium tracking-[-0.03em] !text-white [text-shadow:0_1px_0_rgb(255_255_255_/_6%),0_12px_32px_rgb(0_0_0_/_22%)] max-[560px]:!text-[clamp(40px,13vw,52px)]'
const AUTH_BRAND_CLASS_NAME = 'items-center text-center'
const AUTH_CARD_TITLE_CLASS_NAME =
  'm-0 text-[31px] leading-[1.08] font-semibold tracking-[-0.025em] !text-white max-[560px]:text-[26px]'
const AUTH_CARD_SUBTITLE_CLASS_NAME =
  'self-center mx-auto max-w-[30ch] text-center text-[14px] font-normal leading-[1.5] !text-[rgb(148_164_186_/_58%)]'
const AUTH_EMAIL_DIVIDER_CLASS_NAME =
  "flex items-center gap-2.5 text-[14px] text-[rgb(152_170_194_/_86%)] before:h-px before:flex-1 before:bg-[rgb(78_106_142_/_72%)] before:content-[''] after:h-px after:flex-1 after:bg-[rgb(78_106_142_/_72%)] after:content-['']"
const AUTH_GOOGLE_BUTTON_CLASS_NAME =
  "h-[44px] rounded-[12px] !border !border-[rgb(221_226_234)] !bg-white font-medium !text-[#1f2937] transition-[background-color,border-color,box-shadow] duration-150 hover:!border-[rgb(229_232_238)] hover:!bg-[rgb(250_251_252)] active:!bg-[rgb(240_242_245)] disabled:opacity-70 [&_.mantine-Button-inner]:gap-2.5 [&_.mantine-Button-label]:font-medium [&_.mantine-Button-label]:text-[15px] [&_.mantine-Button-label]:leading-none [&_.mantine-Button-label]:tracking-[-0.01em] [&_.mantine-Button-label]:!text-[#1f2937]"
const AUTH_EMAIL_BUTTON_CLASS_NAME =
  "h-[44px] rounded-[12px] !border !border-[rgb(58_98_146_/_92%)] bg-[rgb(18_49_88_/_96%)] font-medium text-[rgb(116_198_255)] transition-[background-color,border-color,box-shadow] duration-150 hover:!border-[rgb(72_116_168_/_96%)] hover:bg-[rgb(21_57_102_/_96%)] active:bg-[rgb(17_45_79_/_96%)] disabled:opacity-70 [&_.mantine-Button-inner]:gap-2.5 [&_.mantine-Button-label]:font-medium [&_.mantine-Button-label]:text-[15px] [&_.mantine-Button-label]:tracking-[-0.01em]"
const AUTH_OVERLAY_CLASS_NAME =
  'absolute inset-0 flex items-center justify-center rounded-2xl bg-[rgb(8_18_33_/_72%)] backdrop-blur-[3px]'
const AUTH_LEGAL_GROUP_CLASS_NAME = 'mt-0.5 relative z-10'
const AUTH_LEGAL_LINK_CLASS_NAME =
  'text-xs text-[rgb(216_228_244_/_92%)] no-underline transition-colors duration-150 hover:text-white'
const AUTH_DISCLAIMER_CLASS_NAME =
  'relative z-10 mt-0 items-center text-center leading-[1.45] text-[rgb(124_156_191_/_82%)]'
const AUTH_INPUT_LABEL_CLASS_NAME = 'mb-2 text-[13px] font-semibold text-white'
const AUTH_INPUT_CLASS_NAME =
  'h-[36px] rounded-[10px] border border-[rgb(72_96_128_/_76%)] bg-[rgb(33_45_64_/_82%)] px-3 text-[15px] text-[rgb(232_238_248_/_92%)] placeholder:text-[rgb(126_142_164_/_88%)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[rgb(91_118_154_/_84%)] focus:border-[rgb(79_162_255_/_72%)] focus:shadow-[0_0_0_1px_rgb(79_162_255_/_42%)]'
const AUTH_INPUT_WRAPPER_CLASS_NAME = 'gap-0'

const GoogleBrandIcon = () => (
  <svg className="block h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
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
  <Center className={AUTH_SCREEN_CLASS_NAME}>
    <Paper withBorder radius="lg" p="xl" className={AUTH_LOADING_CARD_CLASS_NAME}>
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
    <Center className={AUTH_SCREEN_CLASS_NAME}>
      <Stack gap="md" className={AUTH_SHELL_CLASS_NAME}>
        <Title order={2} className={AUTH_HERO_TITLE_CLASS_NAME}>
          {t('signInHeroTitle')}
        </Title>

        <Paper withBorder p="lg" maw={430} w="100%" radius="lg" className={AUTH_CARD_CLASS_NAME}>
          <Stack gap="lg">
            <Stack gap={4} className={AUTH_BRAND_CLASS_NAME}>
              <Title order={3} className={AUTH_CARD_TITLE_CLASS_NAME}>
                {t('signInCardTitle')}
              </Title>
              <Text size="sm" className={AUTH_CARD_SUBTITLE_CLASS_NAME}>
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
              variant="white"
              onClick={() => void handleGoogleSignIn()}
              leftSection={<GoogleBrandIcon />}
              className={AUTH_GOOGLE_BUTTON_CLASS_NAME}
              disabled={isBusy}
            >
              {t('signInWithGoogle')}
            </Button>

            <div className={AUTH_EMAIL_DIVIDER_CLASS_NAME} role="separator" aria-label={t('signInWithEmail')}>
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
                  classNames={{
                    label: AUTH_INPUT_LABEL_CLASS_NAME,
                    input: AUTH_INPUT_CLASS_NAME,
                    wrapper: AUTH_INPUT_WRAPPER_CLASS_NAME,
                  }}
                />
                <Button
                  fullWidth
                  size="md"
                  variant="light"
                  type="submit"
                  leftSection={<IconMail size={18} />}
                  className={AUTH_EMAIL_BUTTON_CLASS_NAME}
                  disabled={isBusy}
                >
                  {t('sendMagicLink')}
                </Button>
              </Stack>
            </form>
          </Stack>

          {overlayLabel ? (
            <div className={AUTH_OVERLAY_CLASS_NAME}>
              <Stack align="center" gap="xs">
                <Loader type="dots" size="sm" />
                <Text size="sm">{overlayLabel}</Text>
              </Stack>
            </div>
          ) : null}
        </Paper>

        <Group gap="sm" justify="center" className={AUTH_LEGAL_GROUP_CLASS_NAME}>
          <a href="#" onClick={handleLegalLinkClick} className={AUTH_LEGAL_LINK_CLASS_NAME}>
            {t('terms')}
          </a>
          <Text size="xs" className="text-[rgb(124_156_191_/_82%)]">
            •
          </Text>
          <a href="#" onClick={handleLegalLinkClick} className={AUTH_LEGAL_LINK_CLASS_NAME}>
            {t('privacy')}
          </a>
        </Group>

        <Stack gap={2} className={AUTH_DISCLAIMER_CLASS_NAME}>
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
