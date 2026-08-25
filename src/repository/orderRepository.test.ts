import { describe, expect, it, vi } from 'vitest'
import { createOrderSeed, ORDERS_STORAGE_KEY } from '../data/orderFixtures'
import type { OrderStorage } from './orderRepository'
import { createOrderRepository } from './orderRepository'

function fakeStorage(initial: Record<string, string> = {}): OrderStorage & { values: Map<string, string>; fail: boolean; failAfterWrite: boolean } {
  const values = new Map(Object.entries(initial))
  return {
    values, fail: false, failAfterWrite: false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (this.fail) throw new Error('quota')
      if (this.failAfterWrite) { values.set(key, value); throw new Error('interrupted') }
      values.set(key, value)
    },
    removeItem: (key) => { values.delete(key) },
  }
}

describe('orderRepository', () => {
  const now = 2_000_000_000_000

  it('只在 key 缺失时 seed，持久空数组不会被重新填充', () => {
    expect(createOrderRepository({ storage: fakeStorage(), now: () => now }).list()).toHaveLength(6)
    const empty = fakeStorage({ [ORDERS_STORAGE_KEY]: '[]' })
    expect(createOrderRepository({ storage: empty, now: () => now }).list()).toEqual([])
  })

  it('支付、超时和取消共享唯一状态并保持幂等', () => {
    const storage = fakeStorage()
    const repository = createOrderRepository({ storage, now: () => now })
    const pendingId = 'OD20260821000000001'
    expect(repository.cancel(pendingId)).toBe(true)
    expect(repository.cancel(pendingId)).toBe(true)
    expect(repository.get(pendingId)?.status).toBe('cancelled')
    expect(repository.pay(pendingId, 'alipay')).toBe(false)

    const seed = createOrderSeed(now).map((order) => order.id === pendingId ? { ...order, expiresAt: now - 1 } : order)
    expect(repository.restore(seed)).toBe(true)
    expect(repository.pay(pendingId, 'wechat')).toBe(false)
    expect(repository.get(pendingId)?.status).toBe('pay_expired')
  })

  it('正常演示支付记录渠道且不会重复推进', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    expect(repository.pay('OD20260821000000001', 'alipay')).toBe(true)
    expect(repository.pay('OD20260821000000001', 'alipay')).toBe(true)
    expect(repository.get('OD20260821000000001')).toMatchObject({ status: 'paid', paymentMethod: 'alipay', totalAmountCents: 153_600 })
  })

  it('到期批处理仅提交一次并通知订阅', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    const listener = vi.fn(); repository.subscribe(listener)
    expect(repository.expire(now + 31 * 60_000)).toBe(1)
    expect(repository.expire(now + 31 * 60_000)).toBe(0)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('写入中断时回滚原始持久化内容', () => {
    const seed = createOrderSeed(now)
    const before = JSON.stringify(seed)
    const storage = fakeStorage({ [ORDERS_STORAGE_KEY]: before })
    const repository = createOrderRepository({ storage, now: () => now })
    storage.failAfterWrite = true
    expect(repository.cancel('OD20260821000000001')).toBe(false)
    storage.failAfterWrite = false
    expect(storage.getItem(ORDERS_STORAGE_KEY)).toBe(before)
    expect(repository.get('OD20260821000000001')?.status).toBe('pending')
  })
})
