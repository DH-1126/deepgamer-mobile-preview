import type { RealNameStatus } from '../components/accountSettingsModel'
import { getRuntimeStorage } from '../runtime/dataMode'

export type AccountSettingsSnapshot = {
  smsNotifications: boolean
  doNotDisturb: boolean
  realNameStatus: RealNameStatus
  passwordUpdatedAt?: string
  nickname?: string
  avatarDataUrl?: string
  maskedPhone?: string
}

export type AccountSettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const STORAGE_KEY = 'deepgamer.account-settings.v1'
const initialSnapshot: AccountSettingsSnapshot = { smsNotifications: true, doNotDisturb: false, realNameStatus: 'verified' }

function clone(value: AccountSettingsSnapshot): AccountSettingsSnapshot { return { ...value } }
function parse(raw: string | null): AccountSettingsSnapshot | undefined {
  if (!raw) return undefined
  try {
    const value = JSON.parse(raw) as Partial<AccountSettingsSnapshot>
    if (typeof value.smsNotifications !== 'boolean' || typeof value.doNotDisturb !== 'boolean') return undefined
    if (value.realNameStatus !== 'unverified' && value.realNameStatus !== 'reviewing' && value.realNameStatus !== 'verified' && value.realNameStatus !== 'rejected') return undefined
    return { smsNotifications: value.smsNotifications, doNotDisturb: value.doNotDisturb, realNameStatus: value.realNameStatus,
      ...(typeof value.passwordUpdatedAt === 'string' ? { passwordUpdatedAt: value.passwordUpdatedAt } : {}),
      ...(typeof value.nickname === 'string' ? { nickname: value.nickname } : {}),
      ...(typeof value.avatarDataUrl === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value.avatarDataUrl) ? { avatarDataUrl: value.avatarDataUrl } : {}),
      ...(typeof value.maskedPhone === 'string' && /^1[3-9]\d\*{4}\d{4}$/.test(value.maskedPhone) ? { maskedPhone: value.maskedPhone } : {}) }
  } catch { return undefined }
}

export function createAccountSettingsRepository(storage: AccountSettingsStorage) {
  const listeners = new Set<() => void>()
  const read = () => parse(storage.getItem(STORAGE_KEY)) ?? clone(initialSnapshot)
  const commit = (next: AccountSettingsSnapshot) => {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); listeners.forEach((listener) => listener()); return true } catch { return false }
  }
  return {
    getSnapshot: () => clone(read()),
    update(patch: Partial<AccountSettingsSnapshot>) { return commit({ ...read(), ...patch }) },
    markPasswordUpdated(now = new Date()) { return commit({ ...read(), passwordUpdatedAt: now.toISOString() }) },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    reset() { try { storage.removeItem(STORAGE_KEY); listeners.forEach((listener) => listener()); return true } catch { return false } },
  }
}

function memoryStorage(): AccountSettingsStorage {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

const storage: AccountSettingsStorage = getRuntimeStorage()
export const accountSettingsRepository = createAccountSettingsRepository(storage)
