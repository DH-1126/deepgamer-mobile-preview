export type AuthMethod = 'one_tap' | 'code' | 'password'
export type PushPermission = 'prompt' | 'allowed' | 'denied'

export type AuthUser = {
  id: string
  displayName: string
  verified: boolean
}

export type AuthSession = {
  authenticated: true
  user: AuthUser
  method: AuthMethod
  createdAt: number
}

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string }

export type CodeRequestResult =
  | { ok: true; cooldownUntil: number; expiresAt: number }
  | { ok: false; error: string }

export type AgreementRecord = {
  accepted: boolean
  acceptedAt?: number
}

export type PolicySection = {
  id: string
  title: string
  paragraphs: string[]
}
