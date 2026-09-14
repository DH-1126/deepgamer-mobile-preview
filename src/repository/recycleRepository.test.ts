import { describe, expect, it } from 'vitest'
import type { RecycleStorage } from './recycleRepository'
import { createRecycleRepository } from './recycleRepository'
import { createRecycleConsultationSeed, RECYCLE_STORAGE_KEY } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'

function storage(fail = false): RecycleStorage { const data = new Map<string, string>(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { if (fail) throw new Error('quota'); data.set(key, value) }, removeItem: (key) => { data.delete(key) } } }

describe('recycleRepository', () => {
  it('完整推进咨询、报价、补资料、提交和验号成功', () => {
    let now = 2_000_000_000_000
    const repository = createRecycleRepository({ storage: storage(), now: () => ++now })
    const order = repository.begin('fun')!
    expect(repository.get(order.id)?.id).toBe(order.id)
    expect(repository.get('RC-NOT-FOUND')).toBeUndefined()
    expect(repository.acceptOffer(order.id)).toBe(false)
    expect(repository.receiveOffer(order.id)).toBe(true)
    expect(repository.acceptOffer(order.id)).toBe(true)
    expect(repository.createFormalOrder(order.id)).toBe(false)
    repository.setMaterial(order.id, 'battle_screenshot', '1张')
    repository.setMaterial(order.id, 'platform_binding', '没有')
    expect(repository.createFormalOrder(order.id)).toBe(true)
    expect(repository.confirmOrder(order.id)).toBe(true)
    expect(repository.submit(order.id, { loginAccount: '123456789', campId: '88412903', canRealname: true, screenshotCount: 1, note: '', acceptedRules: true })).toBe(true)
    expect(repository.getActive()?.submission?.maskedLoginAccount).toBe('已填写')
    expect(JSON.stringify(repository.getActive())).not.toContain('123456789')
    expect(repository.startInspection(order.id)).toBe(true)
    expect(repository.complete(order.id)).toBe(true)
    expect(repository.getActive()?.stage).toBe('completed')
  })

  it('写入失败时不伪造成功状态', () => {
    const repository = createRecycleRepository({ storage: storage(true) })
    expect(repository.begin('fun')).toBeUndefined()
  })

  it('按新稿完成发单、卖家确认与回收商付款并生成稳定关联编号', () => {
    let now = 2_100_000_000_000
    const repository = createRecycleRepository({ storage: storage(), now: () => ++now })
    const order = repository.begin('fun', 'delta')!
    expect(repository.createFormalOrder(order.id, { quoteCents: 2200, server: '烽火地带', rank: '高段位账号', accountSummary: '依据账号资产概况报价' })).toBe(true)
    expect(repository.get(order.id)?.stage).toBe('formal')
    expect(repository.confirmOrder(order.id)).toBe(true)
    expect(repository.get(order.id)?.stage).toBe('submitted')
    const completed = repository.completePayment(order.id)!
    expect(completed).toMatchObject({ stage: 'completed', orderId: `OD-${order.id}`, conversationId: `trade-recycle-${order.id}` })
    expect(JSON.stringify(completed)).not.toMatch(/手机号|验证码|身份证/)
    expect(repository.completePayment(order.id)).toBeUndefined()
  })

  it('已读后总数下降，且不改变时间、阶段或消息历史', () => {
    const seed = createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)
    const repository = createRecycleRepository({ storage: storage(), seed, now: () => 2_100_000_000_000 })
    const target = repository.get('RC-D3-41206')!
    expect(repository.getUnreadCount()).toBe(24)
    expect(repository.markRead(target.id)).toBe(true)
    expect(repository.getUnreadCount()).toBe(21)
    expect(repository.get(target.id)).toMatchObject({ unreadCount: 0, updatedAt: target.updatedAt, stage: target.stage, messages: target.messages })
  })

  it('无效 ID 失败，重复已读不发送订阅通知', () => {
    const seed = createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)
    const repository = createRecycleRepository({ storage: storage(), seed })
    let notifications = 0
    repository.subscribe(() => { notifications += 1 })
    expect(repository.markRead('RC-NOT-FOUND')).toBe(false)
    expect(repository.markRead(seed.orders[0].id)).toBe(true)
    expect(repository.markRead(seed.orders[0].id)).toBe(true)
    expect(notifications).toBe(1)
  })

  it('已读写入失败不伪造成功并回滚原值', () => {
    const seed = createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)
    const initial = JSON.stringify(seed)
    const data = new Map([[RECYCLE_STORAGE_KEY, initial]])
    let shouldFail = true
    const unstable: RecycleStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => { data.set(key, value); if (shouldFail) { shouldFail = false; throw new Error('quota') } },
      removeItem: (key) => { data.delete(key) },
    }
    const repository = createRecycleRepository({ storage: unstable })
    expect(repository.markRead(seed.orders[0].id)).toBe(false)
    expect(data.get(RECYCLE_STORAGE_KEY)).toBe(initial)
    expect(repository.get(seed.orders[0].id)?.unreadCount).toBe(seed.orders[0].unreadCount)
  })
})
