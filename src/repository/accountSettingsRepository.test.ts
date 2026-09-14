import { describe, expect, it } from 'vitest'
import { createAccountSettingsRepository } from './accountSettingsRepository'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) }, values }
}

describe('accountSettingsRepository', () => {
  it('keeps profile edits across navigation and stores only a masked phone', () => {
    const target = storage()
    const repository = createAccountSettingsRepository(target)
    expect(repository.update({ nickname: '头像编辑演示', avatarDataUrl: 'data:image/png;base64,demo', maskedPhone: '138****0000' })).toBe(true)
    expect(createAccountSettingsRepository(target).getSnapshot()).toMatchObject({ nickname: '头像编辑演示', avatarDataUrl: 'data:image/png;base64,demo', maskedPhone: '138****0000', smsNotifications: true })
    expect([...target.values.values()].join('')).not.toContain('13800000000')
    expect(repository.update({ avatarDataUrl: '' })).toBe(true)
    expect(repository.getSnapshot().avatarDataUrl).toBeUndefined()
  })
  it('returns failure without losing the saved profile when storage rejects an edit', () => {
    const target = storage()
    const repository = createAccountSettingsRepository(target)
    repository.update({ nickname: '原昵称' })
    target.setItem = () => { throw new Error('storage unavailable') }
    expect(repository.update({ nickname: '未保存的昵称' })).toBe(false)
    expect(repository.getSnapshot().nickname).toBe('原昵称')
  })
  it('只持久化状态，不接收密码或实名原文', () => {
    const target = storage()
    const repository = createAccountSettingsRepository(target)
    expect(repository.update({ realNameStatus: 'reviewing', smsNotifications: false })).toBe(true)
    expect(repository.markPasswordUpdated(new Date('2026-09-10T08:08:00.000Z'))).toBe(true)
    expect(repository.getSnapshot()).toMatchObject({ realNameStatus: 'reviewing', smsNotifications: false, passwordUpdatedAt: '2026-09-10T08:08:00.000Z' })
    const persisted = [...target.values.values()].join('')
    expect(persisted).not.toContain('Abcd1234')
    expect(persisted).not.toContain('citizenId')
  })
})
