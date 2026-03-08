import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api'
import { routes } from '@/shared/config/routes'
import { t } from '@/shared/i18n/messages'
import { Center, Loader, Stack, Text } from '@/shared/ui'
import { notifyError, notifySuccess } from '@/shared/ui'

export const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    const status = searchParams.get('status')
    const code = searchParams.get('code')
    const provider = searchParams.get('provider')

    if (status === 'success') {
      notifySuccess(t('oauthSuccess'), { id: 'google-oauth-success' })
    } else {
      notifyError(code ? `${t('oauthError')} (${code})` : t('oauthError'), { id: 'google-oauth-error' })
    }

    void queryClient.invalidateQueries({ queryKey: queryKeys.googleStatus })

    const timeoutId = window.setTimeout(() => {
      const shouldOpenGoogleImport = provider === 'google'
      navigate(shouldOpenGoogleImport ? `${routes.dataroomRoot}?import=google` : routes.dataroomRoot, { replace: true })
    }, 900)

    return () => window.clearTimeout(timeoutId)
  }, [navigate, queryClient, searchParams])

  return (
    <Center mih="100vh">
      <Stack align="center" gap="sm">
        <Loader />
        <Text size="sm" c="dimmed">
          Completing Google connection...
        </Text>
      </Stack>
    </Center>
  )
}
