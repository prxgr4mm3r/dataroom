import type { MeDto } from '@/shared/api'

import type { UserProfile } from './types'

export const mapMeDto = (dto: MeDto): UserProfile => ({
  id: dto.id,
  firebaseUid: dto.firebase_uid,
  email: dto.email,
  displayName: dto.display_name,
  photoUrl: dto.photo_url,
})
