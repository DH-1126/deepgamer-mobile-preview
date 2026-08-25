import { describe, expect, it, vi } from 'vitest'
import { AUTH_SESSION_KEY, createAuthRepository } from './authRepository'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

describe('authRepository', () => {
  it('logs in without persisting submitted secrets', async () => {
    const storage = fakeStorage()
    const repository = createAuthRepository({ storage, now: () => 1234 })
    const result = await repository.loginWithCode('13800138000', '246810', true)
    expect(result.ok).toBe(true)
    const persisted = storage.data.get(AUTH_SESSION_KEY) ?? ''
    expect(persisted).not.toContain('13800138000')
    expect(persisted).not.toContain('246810')
    expect(persisted.toLowerCase()).not.toContain('token')
    expect(repository.getSession()?.user.displayName).toBe('玩家_8471')
  })

  it('accepts arbitrary demo credentials while keeping agreement checks', async () => {
    const repository = createAuthRepository({ storage: fakeStorage() })
    expect((await repository.requestCode('任意内容')).ok).toBe(true)
    expect((await repository.loginWithCode('', '任意验证码', true)).ok).toBe(true)
    expect((await repository.loginWithPassword('', '', false)).ok).toBe(false)
    expect((await repository.loginWithPassword('', '任意密码', true)).ok).toBe(true)
  })

  it('keeps document sessions in memory only', async () => {
    const storage = fakeStorage()
    const repository = createAuthRepository({ storage, persistSession: false })
    expect((await repository.loginOneTap(true)).ok).toBe(true)
    expect(repository.isAuthenticated()).toBe(true)
    expect(storage.data.has(AUTH_SESSION_KEY)).toBe(false)
    const refreshedRepository = createAuthRepository({ storage, persistSession: false })
    expect(refreshedRepository.isAuthenticated()).toBe(false)
  })

  it('tracks the launch sequence only for the current document', () => {
    const storage = fakeStorage()
    const repository = createAuthRepository({ storage, persistSession: false })
    expect(repository.hasCompletedLaunch()).toBe(false)
    repository.completeLaunch()
    expect(repository.hasCompletedLaunch()).toBe(true)
    expect(createAuthRepository({ storage, persistSession: false }).hasCompletedLaunch()).toBe(false)
  })

  it('tracks non-sensitive agreement and push choices', () => {
    const repository = createAuthRepository({ storage: fakeStorage(), now: () => 99 })
    expect(repository.hasAcceptedInitialAgreement()).toBe(false)
    expect(repository.acceptInitialAgreement()).toBe(true)
    expect(repository.hasAcceptedInitialAgreement()).toBe(true)
    expect(repository.getPushPermission()).toBe('prompt')
    expect(repository.setPushPermission('denied')).toBe(true)
    expect(repository.getPushPermission()).toBe('denied')
  })

  it('reports storage failures and notifies subscribers', async () => {
    const storage = fakeStorage()
    const listener = vi.fn()
    const repository = createAuthRepository({ storage })
    repository.subscribe(listener)
    expect((await repository.loginOneTap(true)).ok).toBe(true)
    expect(listener).toHaveBeenCalled()
    storage.setItem = () => { throw new Error('quota') }
    expect((await repository.loginOneTap(true)).ok).toBe(false)
  })
})
