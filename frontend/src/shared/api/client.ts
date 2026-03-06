import axios from 'axios'

import { env } from '@/shared/config/env'

export type AccessTokenGetter = () => Promise<string | null>

let accessTokenGetter: AccessTokenGetter = async () => null

export const setAccessTokenGetter = (getter: AccessTokenGetter): void => {
  accessTokenGetter = getter
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
})

apiClient.interceptors.request.use(async (config) => {
  const token = await accessTokenGetter()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
