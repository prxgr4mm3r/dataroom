import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

import { env } from '@/shared/config/env'

const firebaseApp = initializeApp({
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  appId: env.firebaseAppId,
})

export const firebaseAuth = getAuth(firebaseApp)
