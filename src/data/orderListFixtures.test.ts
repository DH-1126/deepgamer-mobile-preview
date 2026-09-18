import { describe, expect, it } from 'vitest'
import { createOrderSeed } from './orderFixtures'
import { createOrderListSeed } from './orderListFixtures'

const now = new Date(2026, 8, 18, 12).getTime()

describe('order list fixtures', () => {
  it('提供十种基础订单和三种投保阶段，且订单与会话独立关联', () => {
    const seed = createOrderListSeed(now)
    expect(seed.orders).toHaveLength(13)
    expect(seed.orders.map(order => `${order.role}:${order.status}`)).toEqual([
      'buyer:pending', 'buyer:paid', 'buyer:verifying', 'buyer:binding', 'buyer:bind_success',
      'buyer:completed', 'buyer:closed', 'buyer:pay_expired', 'buyer:cancelled', 'seller:completed',
      'buyer:signed', 'buyer:insuring', 'buyer:insured',
    ])
    expect(new Set(seed.orders.map(order => order.id)).size).toBe(13)
    expect(new Set(seed.conversations.map(conversation => conversation.id)).size).toBe(13)
    expect(seed.orders.every(order => order.conversationId && seed.conversations.some(conversation => conversation.id === order.conversationId && conversation.orderId === order.id))).toBe(true)
    expect(seed.messages.every(message => seed.conversations.some(conversation => conversation.id === message.conversationId))).toBe(true)
  })

  it('keeps amounts, product metadata, deadlines and closure reasons meaningful', () => {
    const seed = createOrderListSeed(now)
    const pending = seed.orders[0]
    const completed = seed.orders[5]
    const closed = seed.orders[6]
    const cancelled = seed.orders[8]
    const recycle = seed.orders[9]
    const insuranceStages = seed.orders.slice(10)
    expect(pending.expiresAt).toBe(now + 30 * 60_000)
    expect(seed.orders[4].actionExpiresAt).toBe(now + 72 * 60 * 60_000)
    expect(completed.afterSaleEndsAt).toBe(now + 7 * 24 * 60 * 60_000)
    expect(closed.refundAmountCents).toBe(1_644_280)
    expect(cancelled.cancelReason).toBe('找到更合适的号')
    expect(pending).toMatchObject({ goodsAmountCents: 1_644_280, listTags: ['V11', '铠银白咏叹调', '寅虎心曲'] })
    expect(recycle).toMatchObject({ orderKind: 'recycle', goodsAmountCents: 1_288_000 })
    expect(recycle.productTitle).toMatch(/^回收商品 ·【WZUYX001】/)
    expect(insuranceStages.map(order => order.status)).toEqual(['signed', 'insuring', 'insured'])
    expect(insuranceStages.every(order => order.insuranceAmountCents === 164_428)).toBe(true)
    expect(seed.conversations.slice(10).map(conversation => conversation.workflowPhase)).toEqual(['signed', 'insuring', 'insured'])
  })

  it('adds examples before, without changing, the existing order records', () => {
    const orders = createOrderSeed(now)
    expect(orders.slice(0, 13).map(order => order.id)).toEqual(createOrderListSeed(now).orders.map(order => order.id))
    expect(orders).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'OD20260821000000001', totalAmountCents: 153_600 }),
      expect.objectContaining({ id: 'OD20260820000000006', totalAmountCents: 330_800 }),
    ]))
  })
})
