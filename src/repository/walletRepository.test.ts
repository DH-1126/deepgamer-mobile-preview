import { describe, expect, it, vi } from 'vitest'
import { WALLET_STORAGE_KEY } from '../data/walletFixtures'
import { createWalletRepository, type WalletStorage } from './walletRepository'

function storageFixture(): WalletStorage & { values: Map<string, string>; fail: boolean } {
  const values = new Map<string, string>()
  return {
    values, fail: false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { if (this.fail) throw new Error('quota'); values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

describe('walletRepository', () => {
  it('提交提现申请后同步可用余额、冻结金额和流水', () => {
    const storage = storageFixture()
    const repository = createWalletRepository({ storage, now: () => 1_800_000_000_000 })
    const listener = vi.fn()
    repository.subscribe(listener)
    const before = repository.getSnapshot()
    const result = repository.requestWithdrawal(10_000)
    expect(result).toEqual({ ok: true, transactionId: 'WD1800000000000' })
    const after = repository.getSnapshot()
    expect(after.availableCents).toBe(before.availableCents - 10_000)
    expect(after.frozenCents).toBe(before.frozenCents + 10_000)
    expect(after.transactions[0]).toMatchObject({ id: 'WD1800000000000', amountCents: 10_000, status: 'pending', direction: 'expense' })
    expect(storage.getItem(WALLET_STORAGE_KEY)).not.toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('拒绝非法、超额与同毫秒重复申请', () => {
    const storage = storageFixture()
    const repository = createWalletRepository({ storage, now: () => 1_800_000_000_000 })
    expect(repository.requestWithdrawal(99)).toEqual({ ok: false, error: '提现金额无效' })
    expect(repository.requestWithdrawal(999_999_999)).toEqual({ ok: false, error: '可用余额不足' })
    expect(repository.requestWithdrawal(10_000).ok).toBe(true)
    expect(repository.requestWithdrawal(10_000)).toEqual({ ok: false, error: '请勿重复提交提现申请' })
  })

  it('写入失败时不改变钱包余额', () => {
    const storage = storageFixture()
    const repository = createWalletRepository({ storage, now: () => 1_800_000_000_001 })
    const before = repository.getSnapshot()
    storage.fail = true
    expect(repository.requestWithdrawal(10_000)).toEqual({ ok: false, error: '提现申请保存失败，请重试' })
    expect(repository.getSnapshot()).toEqual(before)
  })
})
