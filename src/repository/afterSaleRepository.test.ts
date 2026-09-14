import { describe, expect, it } from 'vitest'
import { AFTERSALES_STORAGE_KEY, afterSalesFixtures } from '../data/afterSalesFixtures'
import { createOrderSeed } from '../data/orderFixtures'
import { createAfterSaleRepository, type AfterSaleStorage } from './afterSaleRepository'

function fakeStorage(initial: Record<string, string> = {}): AfterSaleStorage {
  const values = new Map(Object.entries(initial))
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

describe('afterSaleRepository', () => {
  const now = new Date('2026-09-07T10:20:00').getTime()
  const order = createOrderSeed(now)[1]

  it('只在存储缺失时写入演示数据', () => {
    expect(createAfterSaleRepository({ storage: fakeStorage(), now: () => now }).list()).toHaveLength(afterSalesFixtures.length)
    expect(createAfterSaleRepository({ storage: fakeStorage({ [AFTERSALES_STORAGE_KEY]: '[]' }), now: () => now }).list()).toEqual([])
  })

  it('申请、补材料、撤销和回流都持久化', () => {
    const repository = createAfterSaleRepository({ storage: fakeStorage({ [AFTERSALES_STORAGE_KEY]: '[]' }), now: () => now })
    const created = repository.create(order, { kind: 'negotiated_refund', reason: '协商退款', description: '卖家超时未完成换绑，希望平台协助退款。', materialNames: ['chat.png'] })!
    expect(repository.get(created.id)).toMatchObject({ status: 'pending_review', orderId: order.id })
    expect(repository.withdraw(created.id)).toBe(true)
    expect(repository.get(created.id)?.status).toBe('withdrawn')
    expect(repository.reopen(created.id)).toBe(true)
    expect(repository.get(created.id)?.status).toBe('pending_review')

    const supplement = { ...repository.get(created.id)!, status: 'supplement' as const }
    expect(repository.restore([supplement])).toBe(true)
    expect(repository.supplement(created.id, '补充了完整聊天记录', ['new.png'])).toBe(true)
    expect(repository.get(created.id)).toMatchObject({ status: 'pending_review', reviewStage: 'resubmitted' })
    expect(repository.get(created.id)?.materialNames).toEqual(['chat.png', 'new.png'])
  })

  it('同一订单有进行中售后时不会重复创建', () => {
    const repository = createAfterSaleRepository({ storage: fakeStorage({ [AFTERSALES_STORAGE_KEY]: '[]' }), now: () => now })
    const input = { kind: 'account_issue' as const, reason: '账号异常', description: '登录时反复提示异常，无法继续验号。', materialNames: ['error.png'] }
    const first = repository.create(order, input)!
    expect(repository.create(order, input)?.id).toBe(first.id)
    expect(repository.list()).toHaveLength(1)
  })
})
