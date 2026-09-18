import { describe, expect, it, vi } from 'vitest'
import { createOrderSeed, ORDERS_STORAGE_KEY } from '../data/orderFixtures'
import { ARCHIVED_TRADE_ID } from '../data/archivedTradeFixtures'
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

  it('为旧演示补齐已关闭群关联的完成订单，不覆盖既有订单且不重复添加', () => {
    const legacy = createOrderSeed(now).filter(order => order.conversationId !== ARCHIVED_TRADE_ID)
    const storage = fakeStorage({ [ORDERS_STORAGE_KEY]: JSON.stringify(legacy) })
    const repository = createOrderRepository({ storage, now: () => now })
    const updated = repository.list()
    expect(updated.filter(order => order.conversationId === ARCHIVED_TRADE_ID)).toHaveLength(1)
    expect(updated.find(order => order.conversationId === ARCHIVED_TRADE_ID)?.status).toBe('completed')
    for (const order of legacy) expect(repository.get(order.id)).toEqual(order)
    expect(repository.list()).toEqual(updated)
  })

  it('只在 key 缺失时 seed，持久空数组不会被重新填充', () => {
    expect(createOrderRepository({ storage: fakeStorage(), now: () => now }).list()).toHaveLength(26)
    const empty = fakeStorage({ [ORDERS_STORAGE_KEY]: '[]' })
    expect(createOrderRepository({ storage: empty, now: () => now }).list()).toEqual([])
  })

  it('旧种子中共享的王者会话会定向迁移为每订单唯一', () => {
    const legacy = createOrderSeed(now).map(order => ['OD20260821000000003', 'OD20260820000000005'].includes(order.id) ? { ...order, conversationId: 'trade-wzry' } : order)
    const repository = createOrderRepository({ storage: fakeStorage({ [ORDERS_STORAGE_KEY]: JSON.stringify(legacy) }), now: () => now })
    const conversationIds = repository.list().map(order => order.conversationId)
    expect(new Set(conversationIds).size).toBe(conversationIds.length)
    expect(repository.get('OD20260821000000003')?.conversationId).toBe('trade-wzry-od03')
    expect(repository.get('OD20260820000000005')?.conversationId).toBe('trade-wzry-od05')
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
    expect(repository.get('OD20260821000000001')).toMatchObject({ status: 'paid', paymentMethod: 'alipay', totalAmountCents: 153_600, paidAt: now })
    expect(repository.get('OD20260821000000001')?.paymentReference).toMatch(/^PAY\d+$/)
  })

  it('保存真实取消原因，重复取消不覆盖第一次选择', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    const id = 'OD3015035674505896501'
    expect(repository.cancel(id, '  价格太高了  ')).toBe(true)
    expect(repository.get(id)).toMatchObject({ status: 'cancelled', cancelReason: '价格太高了' })
    expect(repository.cancel(id, '找到更合适的号')).toBe(true)
    expect(repository.get(id)?.cancelReason).toBe('价格太高了')
    expect(repository.cancel('OD3015035674505896502', '不想买了')).toBe(false)
  })

  it('确认收货只允许从待确认推进到完成', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    expect(repository.confirmReceipt('OD20260821000000001')).toBe(false)
    expect(repository.confirmReceipt('OD20260821000000003')).toBe(true)
    expect(repository.get('OD20260821000000003')?.status).toBe('completed')
  })

  it('签署后按包赔条件进入投保，投保成功前禁止放款', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    const insuredId = 'OD3015035674505896511'
    expect(repository.continueAfterSignature(insuredId)).toBe(true)
    expect(repository.get(insuredId)?.status).toBe('insuring')
    expect(repository.advance(insuredId, 'bind_success')).toBe(false)
    expect(repository.confirmReceipt(insuredId)).toBe(false)
    expect(repository.completeInsurance(insuredId)).toBe(true)
    expect(repository.get(insuredId)?.status).toBe('insured')
    expect(repository.confirmReceipt(insuredId)).toBe(false)
    expect(repository.prepareRelease(insuredId)).toBe(true)
    expect(repository.get(insuredId)?.status).toBe('bind_success')
    expect(repository.confirmReceipt(insuredId)).toBe(true)

    const uninsuredId = 'OD20260821000000002'
    expect(repository.completeBinding(uninsuredId)).toBe(true)
    expect(repository.get(uninsuredId)?.status).toBe('signed')
    expect(repository.continueAfterSignature(uninsuredId)).toBe(true)
    expect(repository.get(uninsuredId)?.status).toBe('bind_success')
  })

  it('异常暂停以订单为粒度并拦截详情页直接放款', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    expect(repository.pause('OD20260821000000003', 'release')).toBe(true)
    expect(repository.get('OD20260821000000003')).toMatchObject({ status: 'bind_success', pausedPhase: 'release' })
    expect(repository.confirmReceipt('OD20260821000000003')).toBe(false)
    expect(repository.advance('OD20260821000000003', 'completed')).toBe(false)
    expect(repository.get('OD20260821000000002')?.pausedPhase).toBeUndefined()
  })

  it('动态订单幂等创建且拒绝复用其他订单的会话', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    const record = { ...createOrderSeed(now)[0], id: 'OD-RC-1', productId: 'recycle-RC-1', conversationId: 'trade-recycle-RC-1', role: 'seller' as const, status: 'paid' as const }
    expect(repository.ensure(record)).toBe(true)
    expect(repository.ensure(record)).toBe(true)
    expect(repository.ensure({ ...record, id: 'OD-RC-2' })).toBe(false)
    expect(repository.get('OD-RC-1')).toMatchObject({ conversationId: 'trade-recycle-RC-1', status: 'paid', role: 'seller' })
    expect(repository.restore([record, { ...record, id: 'OD-RC-2' }])).toBe(false)
  })

  it('到期批处理仅提交一次并通知订阅', () => {
    const repository = createOrderRepository({ storage: fakeStorage(), now: () => now })
    const listener = vi.fn(); repository.subscribe(listener)
    expect(repository.expire(now + 31 * 60_000)).toBe(2)
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
