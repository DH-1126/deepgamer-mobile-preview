import { demoAuthUser } from '../data/authFixtures'
import type { AgreementRecord, AuthMethod, AuthResult, AuthSession, CodeRequestResult, PushPermission } from '../types/auth'

export type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Options = { storage: AuthStorage; now?: () => number; eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>; persistSession?: boolean }

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

export function createAuthRepository({ storage, now = Date.now, eventTarget, persistSession = true }: Options) {
  const listeners = new Set<() => void>()
  let documentSession: AuthSession | undefined
  let launchCompleted = false
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
      if (!agreed) return { ok: false, error: '请先阅读并同意用户服务协议' }
      return createSession('password')
    },
    logout() {
      if (!persistSession) { documentSession = undefined; emit(); return true }
      try { storage.removeItem(AUTH_SESSION_KEY); emit(); return true } catch { return false }
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

let storage: AuthStorage = memoryStorage()
let eventTarget: Options['eventTarget']
if (typeof window !== 'undefined') { try { storage = window.localStorage; eventTarget = window } catch { /* storage unavailable */ } }
export const authRepository = createAuthRepository({ storage, eventTarget, persistSession: false })
