import type { GoogleStatusDto } from '@/shared/api'

import type { GoogleConnectionStatus } from './types'

export const mapGoogleStatusDto = (dto: GoogleStatusDto): GoogleConnectionStatus => {
  if (!dto.connected) {
    return { connected: false }
  }

  return {
    connected: true,
    googleEmail: dto.google_email,
    tokenExpired: dto.token_expired,
  }
}
