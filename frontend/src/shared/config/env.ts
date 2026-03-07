const requireEnv = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const optionalIntEnv = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

const DEFAULT_MAX_IMPORT_FILE_SIZE_BYTES = 4 * 1024 * 1024

export const env = {
  apiBaseUrl: requireEnv(import.meta.env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
  firebaseApiKey: requireEnv(import.meta.env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY'),
  firebaseAuthDomain: requireEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 'VITE_FIREBASE_AUTH_DOMAIN'),
  firebaseProjectId: requireEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID'),
  firebaseAppId: requireEnv(import.meta.env.VITE_FIREBASE_APP_ID, 'VITE_FIREBASE_APP_ID'),
  maxImportFileSizeBytes: optionalIntEnv(
    import.meta.env.VITE_MAX_IMPORT_FILE_SIZE_BYTES,
    DEFAULT_MAX_IMPORT_FILE_SIZE_BYTES,
  ),
} as const
