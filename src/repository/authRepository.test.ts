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

  it('keeps one-tap and code login relaxed while password login validates credentials', async () => {
    const repository = createAuthRepository({ storage: fakeStorage() })
    expect((await repository.requestCode('任意内容')).ok).toBe(true)
    expect((await repository.loginWithCode('', '任意验证码', true)).ok).toBe(true)
    expect((await repository.loginWithPassword('', '', false)).ok).toBe(false)
    expect(await repository.loginWithPassword('', '任意密码', true)).toMatchObject({ ok: false })
    expect((await repository.loginWithPassword('187 8866 0033', 'demo2026', true)).ok).toBe(true)
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

  it('reports unregistered phones and registers the originally supplied password after a scoped SMS challenge', async () => {
    const storage = fakeStorage()
    const repository = createAuthRepository({ storage })
    const phone = '13800138000'
    // Registration intentionally does not impose the account-settings reset policy.
    expect(await repository.loginWithPassword(phone, 'legacy', true)).toMatchObject({ ok: false, reason: 'unregistered' })
    expect((await repository.requestPasswordCode(phone, 'reset')).ok).toBe(true)
    expect(await repository.registerWithCode(phone, 'legacy', '246810', true)).toMatchObject({ ok: false, field: 'code' })
    expect((await repository.requestPasswordCode(phone, 'register')).ok).toBe(true)
    expect(await repository.registerWithCode(phone, 'legacy', '000000', true)).toMatchObject({ ok: false, field: 'code' })
    expect(await repository.registerWithCode('13900139000', 'legacy', '246810', true)).toMatchObject({ ok: false, field: 'code' })
    expect((await repository.registerWithCode(phone, 'legacy', '246810', true)).ok).toBe(true)
    expect((await repository.loginWithPassword(phone, 'legacy', true)).ok).toBe(true)
    const persisted = [...storage.data.values()].join(' ')
    expect(persisted).not.toContain(phone)
    expect(persisted).not.toContain('legacy')
    expect(persisted).not.toContain('246810')
  })

  it('enforces agreement, phone, and password input guards without consuming a valid registration challenge', async () => {
    const repository = createAuthRepository({ storage: fakeStorage(), persistSession: false })
    const phone = '13900139000'
    expect(await repository.requestPasswordCode(phone, 'register')).toMatchObject({ ok: true })
    expect(await repository.registerWithCode(phone, '', '246810', true)).toMatchObject({ ok: false, field: 'password' })
    expect(await repository.registerWithCode(phone, 'any password', '246810', false)).toMatchObject({ ok: false })
    expect(await repository.registerWithCode(phone, 'any password', '246810', true)).toMatchObject({ ok: true })
    expect(await repository.loginWithPassword('invalid', 'x', true)).toMatchObject({ ok: false })
  })

  it('counts wrong passwords separately, resets the count after success, and supports a configured threshold', async () => {
    const repository = createAuthRepository({ storage: fakeStorage(), persistSession: false, policy: { passwordErrorLimit: 2 } })
    const phone = '18788660033'
    expect(await repository.loginWithPassword(phone, 'wrong', true)).toMatchObject({ ok: false, reason: 'incorrect_password', attemptsRemaining: 1 })
    expect((await repository.loginWithPassword(phone, 'demo2026', true)).ok).toBe(true)
    expect(await repository.loginWithPassword(phone, 'wrong', true)).toMatchObject({ ok: false, reason: 'incorrect_password', attemptsRemaining: 1 })
    expect(await repository.loginWithPassword(phone, 'wrong', true)).toMatchObject({ ok: false, reason: 'password_reset_required', attemptsRemaining: 0 })
  })

  it('uses the default three-attempt limit and isolates counters between registered phones', async () => {
    const repository = createAuthRepository({ storage: fakeStorage(), persistSession: false })
    const primary = '18788660033'
    const secondary = '13800138000'
    await repository.requestPasswordCode(secondary, 'register')
    await repository.registerWithCode(secondary, 'legacy', '246810', true)
    expect(await repository.loginWithPassword(primary, 'wrong', true)).toMatchObject({ reason: 'incorrect_password', attemptsRemaining: 2 })
    expect(await repository.loginWithPassword(secondary, 'wrong', true)).toMatchObject({ reason: 'incorrect_password', attemptsRemaining: 2 })
    expect(await repository.loginWithPassword(primary, 'wrong', true)).toMatchObject({ reason: 'incorrect_password', attemptsRemaining: 1 })
    expect(await repository.loginWithPassword(primary, 'wrong', true)).toMatchObject({ reason: 'password_reset_required', attemptsRemaining: 0 })
    expect(await repository.loginWithPassword(secondary, 'legacy', true)).toMatchObject({ ok: true })
  })

  it('expires, throttles, scopes, and consumes password SMS challenges only on successful registration', async () => {
    let current = 1000
    const repository = createAuthRepository({ storage: fakeStorage(), persistSession: false, now: () => current })
    const phone = '13800138000'
    expect((await repository.requestPasswordCode(phone, 'register')).ok).toBe(true)
    expect(repository.getPasswordCodeCooldown(phone, 'register')).toBe(61_000)
    current += 1_000
    // A dialog close/reopen reads the same deadline, rather than restarting it.
    expect(repository.getPasswordCodeCooldown(phone, 'register')).toBe(61_000)
    expect(await repository.requestPasswordCode(phone, 'register')).toMatchObject({ ok: false })
    expect(await repository.registerWithCode(phone, 'prototype-password', '246810', true)).toMatchObject({ ok: true })
    expect(await repository.registerWithCode(phone, 'prototype-password', '246810', true)).toMatchObject({ ok: false })
    current += 60_000
    expect((await repository.requestPasswordCode(phone, 'reset')).ok).toBe(true)
    expect(await repository.resetPasswordWithCode(phone, 'newPassword8', 'newPassword8', '246810', true)).toMatchObject({ ok: true })
    expect(await repository.resetPasswordWithCode(phone, 'newPassword9', 'newPassword9', '246810', true)).toMatchObject({ ok: false, field: 'code' })
    const other = '13900139000'
    expect((await repository.requestPasswordCode(other, 'register')).ok).toBe(true)
    expect(await repository.registerWithCode(other, 'password', '246810', true)).toMatchObject({ ok: true })
    current += 5 * 60_000 + 1
    expect(await repository.requestPasswordCode(other, 'reset')).toMatchObject({ ok: true })
    current += 5 * 60_000 + 1
    expect(await repository.resetPasswordWithCode(other, 'newPassword8', 'newPassword8', '246810', true)).toMatchObject({ ok: false, error: '验证码已过期，请重新获取', field: 'code' })
  })

  it('resets a registered password, logs in, clears attempts, and invalidates the old password', async () => {
    const repository = createAuthRepository({ storage: fakeStorage(), persistSession: false })
    const phone = '18788660033'
    await repository.loginWithPassword(phone, 'wrong', true)
    expect((await repository.requestPasswordCode(phone, 'reset')).ok).toBe(true)
    expect(await repository.resetPasswordWithCode(phone, 'nextDemo8', 'nextDemo8', '246810', false)).toMatchObject({ ok: false })
    expect(await repository.resetPasswordWithCode(phone, 'nextDemo8', 'mismatch', '246810', true)).toMatchObject({ ok: false, field: 'confirmation' })
    expect(await repository.resetPasswordWithCode(phone, 'short', 'short', '246810', true)).toMatchObject({ ok: false, field: 'password' })
    expect(await repository.resetPasswordWithCode(phone, 'nextDemo8', 'nextDemo8', '000000', true)).toMatchObject({ ok: false, field: 'code' })
    expect(await repository.resetPasswordWithCode(phone, 'nextDemo8', 'nextDemo8', '246810', true)).toMatchObject({ ok: true })
    expect(await repository.loginWithPassword(phone, 'demo2026', true)).toMatchObject({ ok: false, reason: 'incorrect_password', attemptsRemaining: 2 })
    expect((await repository.loginWithPassword(phone, 'nextDemo8', true)).ok).toBe(true)
  })

  it('does not mutate a registration if session persistence fails', async () => {
    const storage = fakeStorage()
    const repository = createAuthRepository({ storage })
    const phone = '13900139000'
    await repository.requestPasswordCode(phone, 'register')
    storage.setItem = () => { throw new Error('quota') }
    expect(await repository.registerWithCode(phone, 'any password', '246810', true)).toMatchObject({ ok: false })
    storage.setItem = (key: string, value: string) => { storage.data.set(key, value) }
    expect(await repository.loginWithPassword(phone, 'any password', true)).toMatchObject({ ok: false, reason: 'unregistered' })
    expect((await repository.registerWithCode(phone, 'any password', '246810', true)).ok).toBe(true)
  })

  it('starts each fresh repository with no dynamically registered accounts, counters, or challenges', async () => {
    const storage = fakeStorage()
    const first = createAuthRepository({ storage, persistSession: false })
    await first.requestPasswordCode('13800138000', 'register')
    await first.registerWithCode('13800138000', 'kept in memory', '246810', true)
    const refreshed = createAuthRepository({ storage, persistSession: false })
    expect(await refreshed.loginWithPassword('13800138000', 'kept in memory', true)).toMatchObject({ ok: false, reason: 'unregistered' })
    expect(await refreshed.registerWithCode('13800138000', 'kept in memory', '246810', true)).toMatchObject({ ok: false, field: 'code' })
  })
})
