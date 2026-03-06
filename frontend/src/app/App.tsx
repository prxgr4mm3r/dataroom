import { Alert, Button, Center, Loader, Paper, Stack, Text, Title } from '@/shared/ui'
import { t } from '@/shared/i18n/messages'
import { toApiError } from '@/shared/api'
import { useCurrentUserQuery } from '@/features/load-current-user'
import { useAuth } from '@/app/providers'
import { routes } from '@/shared/config/routes'
import { DataroomPage } from '@/pages/dataroom-page'
import { OAuthCallbackPage } from '@/pages/oauth-callback-page'
import { Navigate, Route, Routes } from 'react-router-dom'

const SignInScreen = () => {
  const { signInWithGoogle } = useAuth()

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" maw={420} w="100%" radius="md">
        <Stack>
          <Title order={3}>{t('signInTitle')}</Title>
          <Button onClick={() => void signInWithGoogle()}>{t('signInWithGoogle')}</Button>
        </Stack>
      </Paper>
    </Center>
  )
}

const RequireAuth = () => {
  const { loading, isAuthenticated, signOutUser } = useAuth()
  const meQuery = useCurrentUserQuery(isAuthenticated)

  if (loading) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }

  if (!isAuthenticated) {
    return <SignInScreen />
  }

  if (meQuery.isPending) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    )
  }

  if (meQuery.error) {
    const apiError = toApiError(meQuery.error)
    return (
      <Center mih="100vh" p="md">
        <Paper withBorder p="lg" maw={560} w="100%">
          <Stack>
            <Alert color="red" title="Authentication failed">
              <Text size="sm">{apiError.message}</Text>
            </Alert>
            <Button variant="light" onClick={() => void signOutUser()}>
              Sign out
            </Button>
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
    <Route path={routes.dataroomRoot} element={<RequireAuth />} />
    <Route path={routes.dataroomFolder} element={<RequireAuth />} />
    <Route path="*" element={<Navigate to={routes.dataroomRoot} replace />} />
  </Routes>
)
