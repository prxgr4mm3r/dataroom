import axios from 'axios'

import type { ApiErrorCode } from '@/shared/types/common'
import type { ErrorEnvelopeDto } from './openapi/types'

export type ApiError = {
  status: number
  code: ApiErrorCode
  message: string
}

const FALLBACK_MESSAGE = 'Unexpected error. Please try again.'

export const toApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 500
    const payload = error.response?.data as ErrorEnvelopeDto | undefined
    const code = payload?.error?.code ?? 'unknown_error'
    const message = payload?.error?.message ?? error.message ?? FALLBACK_MESSAGE
    return { status, code, message }
  }

  if (error instanceof Error) {
    return {
      status: 500,
      code: 'unknown_error',
      message: error.message || FALLBACK_MESSAGE,
    }
  }

  return {
    status: 500,
    code: 'unknown_error',
    message: FALLBACK_MESSAGE,
  }
}

export const isAuthError = (error: ApiError): boolean => error.status === 401
