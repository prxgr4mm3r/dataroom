export type GoogleConnectionStatus =
  | {
      connected: false
    }
  | {
      connected: true
      googleEmail: string | null
      tokenExpired: boolean
    }
