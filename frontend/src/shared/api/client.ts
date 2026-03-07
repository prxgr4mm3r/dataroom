import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

import { env } from '@/shared/config/env'

export type AccessTokenGetter = (forceRefresh?: boolean) => Promise<string | null>

let accessTokenGetter: AccessTokenGetter = async () => null
let refreshTokenPromise: Promise<string | null> | null = null

type ErrorEnvelope = {
  error?: {
    code?: string
  }
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _tokenRefreshRetried?: boolean
}

export const setAccessTokenGetter = (getter: AccessTokenGetter): void => {
  accessTokenGetter = getter
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
})

apiClient.interceptors.request.use(async (config) => {
  const headers = (config.headers ?? {}) as Record<string, unknown>
  const hasAuthHeader = Boolean(headers.Authorization ?? headers.authorization)

  if (!hasAuthHeader) {
    const token = await accessTokenGetter()
    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

const isUnauthorizedError = (error: AxiosError): boolean => {
  if (error.response?.status !== 401) {
    return false
  }
  const payload = error.response.data as ErrorEnvelope | undefined
  return payload?.error?.code === undefined || payload.error.code === 'unauthorized'
}

const getRefreshedToken = async (): Promise<string | null> => {
  if (!refreshTokenPromise) {
    refreshTokenPromise = accessTokenGetter(true).finally(() => {
      refreshTokenPromise = null
    })
  }
  return refreshTokenPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const requestConfig = error.config as RetriableRequestConfig | undefined

    if (!requestConfig || requestConfig._tokenRefreshRetried || !isUnauthorizedError(error)) {
      return Promise.reject(error)
    }

    requestConfig._tokenRefreshRetried = true

    try {
      const refreshedToken = await getRefreshedToken()
      if (!refreshedToken) {
        return Promise.reject(error)
      }

      requestConfig.headers = requestConfig.headers ?? {}
      requestConfig.headers.Authorization = `Bearer ${refreshedToken}`
      return apiClient.request(requestConfig)
    } catch {
      return Promise.reject(error)
    }
  },
)
