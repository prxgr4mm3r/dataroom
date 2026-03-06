import { describe, expect, it } from 'vitest'

import { toApiError } from './errors'

describe('toApiError', () => {
  it('maps axios-like error with envelope', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed',
      response: {
        status: 401,
        data: {
          error: {
            code: 'unauthorized',
            message: 'Missing Bearer token.',
          },
        },
      },
    }

    expect(toApiError(error)).toEqual({
      status: 401,
      code: 'unauthorized',
      message: 'Missing Bearer token.',
    })
  })

  it('maps generic error', () => {
    expect(toApiError(new Error('Boom'))).toEqual({
      status: 500,
      code: 'unknown_error',
      message: 'Boom',
    })
  })

  it('maps payload for 413-style api errors', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed',
      response: {
        status: 413,
        data: {
          error: {
            code: 'file_too_large',
            message: 'Selected file exceeds size limit.',
          },
        },
      },
    }

    expect(toApiError(error)).toEqual({
      status: 413,
      code: 'file_too_large',
      message: 'Selected file exceeds size limit.',
    })
  })
})
