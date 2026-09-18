import { DEMO_CODE, DEMO_PASSWORD, demoAuthUser } from '../data/authFixtures'
import { authPolicy, type AuthPolicy } from '../data/authPolicy'
import { passwordRequirements } from '../components/accountSettingsModel'
import { isValidMainlandPhone, normalizeCode, normalizePhone } from '../components/authModel'
import type { AgreementRecord, AuthMethod, AuthResult, AuthSession, CodeRequestResult, PushPermission } from '../types/auth'
import { getRuntimeStorage, isLinkedDataMode } from '../runtime/dataMode'

export type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type PasswordCodePurpose = 'register' | 'reset'
export type AuthRepositoryOptions = {
  storage: AuthStorage
  now?: () => number
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>
  persistSession?: boolean
  policy?: Partial<AuthPolicy>
}
type PasswordChallenge = { code: string; cooldownUntil: number; expiresAt: number }
export type PasswordResetResult = { ok: true } | Extract<AuthResult, { ok: false }>

export const AUTH_SESSION_KEY = 'deepgamer.auth.session.v1'
export const AUTH_AGREEMENT_KEY = 'deepgamer.auth.agreement.v1'
export const AUTH_PUSH_KEY = 'deepgamer.auth.push.v1'
const EVENT = 'deepgamer:auth-change'

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined
  try { return JSON.parse(raw) as T } catch { return undefined }
}

function validSession(value: AuthSession | undefined): value is AuthSession {
  return Boolean(value?.authenticated && value.user?.id === demoAuthUser.id && ['one_tap', 'code', 'password'].includes(value.method))
}

export function createAuthRepository({ storage, now = Date.now, eventTarget, persistSession = true, policy: policyOverride }: AuthRepositoryOptions) {
  const listeners = new Set<() => void>()
  let documentSession: AuthSession | undefined
  let launchCompleted = false
  // Prototype-only, per-repository memory. Never put credentials, phones, or
  // SMS codes in Storage, logs, or a network request.
  const passwords = new Map<string, string>([['18788660033', DEMO_PASSWORD]])
  const passwordAttempts = new Map<string, number>()
  const passwordChallenges = new Map<string, PasswordChallenge>()
  const passwordErrorLimit = Number.isInteger(policyOverride?.passwordErrorLimit) && (policyOverride?.passwordErrorLimit ?? 0) > 0
    ? policyOverride!.passwordErrorLimit!
    : authPolicy.passwordErrorLimit
  const source = Math.random().toString(36).slice(2)
  const emit = () => {
    listeners.forEach((listener) => listener())
    if (eventTarget && typeof CustomEvent !== 'undefined') eventTarget.dispatchEvent(new CustomEvent(EVENT, { detail: { source } }))
  }
  const set = (key: string, value: unknown) => {
    try { storage.setItem(key, JSON.stringify(value)); emit(); return true } catch { return false }
  }
  const createSession = (method: AuthMethod): AuthResult => {
    const session: AuthSession = { authenticated: true, user: { ...demoAuthUser }, method, createdAt: now() }
    if (!persistSession) { documentSession = session; emit(); return { ok: true, session } }
    return set(AUTH_SESSION_KEY, session) ? { ok: true, session } : { ok: false, error: '登录状态保存失败，请重试' }
  }
  const clearSession = () => {
    if (!persistSession) { documentSession = undefined; emit(); return true }
    try { storage.removeItem(AUTH_SESSION_KEY); emit(); return true } catch { return false }
  }
  const agreementError = (): AuthResult => ({ ok: false, error: '请先阅读并同意用户服务协议和隐私政策' })
  const invalidPhone = (): AuthResult => ({ ok: false, error: '请输入正确的手机号' })
  const passwordChallengeKey = (phone: string, purpose: PasswordCodePurpose) => `${purpose}:${phone}`
  const getChallenge = (phone: string, purpose: PasswordCodePurpose) => {
    const key = passwordChallengeKey(phone, purpose)
    const challenge = passwordChallenges.get(key)
    if (challenge && challenge.expiresAt <= now()) {
      passwordChallenges.delete(key)
      return undefined
    }
    return challenge
  }
  const validatePasswordCode = (phone: string, purpose: PasswordCodePurpose, code: string): Extract<AuthResult, { ok: false }> | undefined => {
    const key = passwordChallengeKey(phone, purpose)
    const challenge = passwordChallenges.get(key)
    if (!challenge) return { ok: false, error: '请先获取验证码', field: 'code' }
    if (challenge.expiresAt <= now()) {
      passwordChallenges.delete(key)
      return { ok: false, error: '验证码已过期，请重新获取', field: 'code' }
    }
    if (normalizeCode(code) !== code || code !== challenge.code) return { ok: false, error: '验证码错误，请重新输入', field: 'code' }
    return undefined
  }
  const external = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.source === source) return
    if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent && event.key && ![AUTH_SESSION_KEY, AUTH_AGREEMENT_KEY, AUTH_PUSH_KEY].includes(event.key)) return
    listeners.forEach((listener) => listener())
  }
  eventTarget?.addEventListener(EVENT, external)
  eventTarget?.addEventListener('storage', external)

  return {
    getSession() {
      const value = persistSession ? safeParse<AuthSession>(storage.getItem(AUTH_SESSION_KEY)) : documentSession
      return validSession(value) ? { ...value, user: { ...value.user } } : undefined
    },
    hasCompletedLaunch() { return launchCompleted },
    completeLaunch() { launchCompleted = true },
    isAuthenticated() { return validSession(persistSession ? safeParse<AuthSession>(storage.getItem(AUTH_SESSION_KEY)) : documentSession) },
    async loginOneTap(agreed: boolean): Promise<AuthResult> {
      if (!agreed) return { ok: false, error: '请先阅读并同意用户服务协议和隐私政策' }
      return createSession('one_tap')
    },
    async requestCode(phone: string): Promise<CodeRequestResult> {
      const current = now()
      return { ok: true, cooldownUntil: current + 60_000, expiresAt: current + 5 * 60_000 }
    },
    async loginWithCode(phone: string, code: string, agreed: boolean): Promise<AuthResult> {
      if (!agreed) return { ok: false, error: '请先阅读并同意用户服务协议和隐私政策' }
      return createSession('code')
    },
    async loginWithPassword(phone: string, password: string, agreed: boolean): Promise<AuthResult> {
      if (!agreed) return agreementError()
      const normalizedPhone = normalizePhone(phone)
      if (!isValidMainlandPhone(normalizedPhone)) return invalidPhone()
      if (!password) return { ok: false, error: '请输入密码', field: 'password' }
      const storedPassword = passwords.get(normalizedPhone)
      if (storedPassword === undefined) return { ok: false, error: '该手机号尚未注册，请先完成注册', reason: 'unregistered' }
      if (password !== storedPassword) {
        const attempts = (passwordAttempts.get(normalizedPhone) ?? 0) + 1
        passwordAttempts.set(normalizedPhone, attempts)
        const attemptsRemaining = Math.max(0, passwordErrorLimit - attempts)
        if (attempts >= passwordErrorLimit) return { ok: false, error: '密码错误次数过多，请通过验证码重置密码', reason: 'password_reset_required', field: 'password', attemptsRemaining }
        return { ok: false, error: '密码错误，请重试', reason: 'incorrect_password', field: 'password', attemptsRemaining }
      }
      passwordAttempts.delete(normalizedPhone)
      return createSession('password')
    },
    async requestPasswordCode(phone: string, purpose: PasswordCodePurpose): Promise<CodeRequestResult> {
      const normalizedPhone = normalizePhone(phone)
      if (!isValidMainlandPhone(normalizedPhone)) return { ok: false, error: '请输入正确的手机号' }
      const current = now()
      const currentChallenge = getChallenge(normalizedPhone, purpose)
      if (currentChallenge && currentChallenge.cooldownUntil > current) return { ok: false, error: '请稍后再试' }
      const challenge = { code: DEMO_CODE, cooldownUntil: current + 60_000, expiresAt: current + 5 * 60_000 }
      passwordChallenges.set(passwordChallengeKey(normalizedPhone, purpose), challenge)
      return { ok: true, cooldownUntil: challenge.cooldownUntil, expiresAt: challenge.expiresAt }
    },
    getPasswordCodeCooldown(phone: string, purpose: PasswordCodePurpose) {
      const normalizedPhone = normalizePhone(phone)
      if (!isValidMainlandPhone(normalizedPhone)) return 0
      const challenge = getChallenge(normalizedPhone, purpose)
      return challenge ? challenge.cooldownUntil : 0
    },
    async registerWithCode(phone: string, password: string, code: string, agreed: boolean): Promise<AuthResult> {
      if (!agreed) return agreementError()
      const normalizedPhone = normalizePhone(phone)
      if (!isValidMainlandPhone(normalizedPhone)) return invalidPhone()
      if (!password) return { ok: false, error: '请输入密码', field: 'password' }
      if (passwords.has(normalizedPhone)) return { ok: false, error: '该手机号已注册，请使用密码登录' }
      const codeError = validatePasswordCode(normalizedPhone, 'register', code)
      if (codeError) return codeError
      const result = createSession('password')
      if (!result.ok) return result
      passwords.set(normalizedPhone, password)
      passwordChallenges.delete(passwordChallengeKey(normalizedPhone, 'register'))
      return result
    },
    async resetPasswordWithCode(phone: string, password: string, confirmation: string, code: string, agreed: boolean): Promise<PasswordResetResult> {
      if (!agreed) return agreementError()
      const normalizedPhone = normalizePhone(phone)
      if (!isValidMainlandPhone(normalizedPhone)) return invalidPhone()
      if (!passwords.has(normalizedPhone)) return { ok: false, error: '该手机号尚未注册', reason: 'unregistered' }
      const requirements = passwordRequirements(password, confirmation)
      if (!requirements.length || !requirements.composition) return { ok: false, error: '密码需为 8-18 位，并同时包含字母和数字', field: 'password' }
      if (!requirements.matches) return { ok: false, error: '两次输入的密码不一致', field: 'confirmation' }
      const codeError = validatePasswordCode(normalizedPhone, 'reset', code)
      if (codeError) return codeError
      // Resetting a credential invalidates the current session. The user must
      // prove the new password in a fresh password-login flow.
      if (!clearSession()) return { ok: false, error: '登录状态更新失败，请重试' }
      passwords.set(normalizedPhone, password)
      passwordAttempts.delete(normalizedPhone)
      passwordChallenges.delete(passwordChallengeKey(normalizedPhone, 'reset'))
      return { ok: true }
    },
    logout() {
      return clearSession()
    },
    hasAcceptedInitialAgreement() { return safeParse<AgreementRecord>(storage.getItem(AUTH_AGREEMENT_KEY))?.accepted === true },
    acceptInitialAgreement() { return set(AUTH_AGREEMENT_KEY, { accepted: true, acceptedAt: now() } satisfies AgreementRecord) },
    getPushPermission(): PushPermission {
      const value = safeParse<PushPermission>(storage.getItem(AUTH_PUSH_KEY))
      return value === 'allowed' || value === 'denied' ? value : 'prompt'
    },
    setPushPermission(value: Exclude<PushPermission, 'prompt'>) { return set(AUTH_PUSH_KEY, value) },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() { eventTarget?.removeEventListener(EVENT, external); eventTarget?.removeEventListener('storage', external); listeners.clear() },
  }
}

function memoryStorage(): AuthStorage {
  const data = new Map<string, string>()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}

let storage: AuthStorage = getRuntimeStorage()
let eventTarget: AuthRepositoryOptions['eventTarget']
if (typeof window !== 'undefined' && !isLinkedDataMode) eventTarget = window
export const authRepository = createAuthRepository({ storage, eventTarget, persistSession: false })
