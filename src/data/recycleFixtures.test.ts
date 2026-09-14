import { describe, expect, it } from 'vitest'
import { getRecycleConversationName, getRecycleConversationStatus, getRecycleUnreadCount } from '../components/recycleConversationModel'
import { recyclerFixtures } from './sellFixtures'
import { createRecycleConsultationSeed, createRecycleOrder } from './recycleFixtures'

describe('recycleFixtures', () => {
  it('提供 8 条固定交错的咨询会话样例', () => {
    const seed = createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)
    expect(seed.orders).toHaveLength(8)
    expect(seed.orders.map(getRecycleConversationName)).toEqual(['买家1', '回收商1', '买家2', '回收商2', '买家3', '回收商3', '买家4', '回收商4'])
    expect(seed.orders.map(getRecycleConversationStatus)).toEqual(['已下单', '已下单', '已下单', '已下单', '沟通中', '沟通中', '已下单', '已下单'])
    expect(seed.orders.every((order) => getRecycleUnreadCount(order) > 0)).toBe(true)
    expect(seed.orders.map(getRecycleUnreadCount)).toEqual([2, 5, 1, 3, 2, 4, 1, 6])
  })

  it('保留原有回收单的 ID、阶段和交易关联字段', () => {
    const seed = createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)
    expect(seed.orders.find((order) => order.id === 'RC-D3-33210')).toMatchObject({ stage: 'formal' })
    expect(seed.orders.find((order) => order.id === 'RC-D3-41206')).toMatchObject({ stage: 'submitted', sellerConfirmedAt: expect.any(Number) })
    expect(seed.orders.find((order) => order.id === 'RC-D3-50817')).toMatchObject({ stage: 'completed', conversationId: 'trade-recycle-RC-D3-50817', orderId: 'OD-RC-D3-50817', sellerConfirmedAt: expect.any(Number), paidAt: expect.any(Number) })
  })

  it('每条末条文案与阶段一致，且样例不包含真实个人信息', () => {
    const seed = createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)
    const lastMessages = seed.orders.map((order) => order.messages.at(-1)?.content ?? '')
    expect(lastMessages).toEqual(expect.arrayContaining([
      expect.stringContaining('沟通'), expect.stringContaining('正式回收单'), expect.stringContaining('回收商付款已完成，可进入交易群继续交易'),
    ]))
    expect(JSON.stringify(seed)).not.toMatch(/密码|验证码|身份证|手机号|(?:^|\D)1[3-9]\d{9}(?:\D|$)/)
  })

  it('新建咨询默认已读，旧数据不需迁移也视为 0', () => {
    const order = createRecycleOrder(recyclerFixtures[0], 2_000_000_000_000)
    expect(order.unreadCount).toBe(0)
    const legacy = { ...order }
    delete legacy.unreadCount
    expect(getRecycleUnreadCount(legacy)).toBe(0)
  })
})
