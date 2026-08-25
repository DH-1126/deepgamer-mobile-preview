import { describe, expect, it } from 'vitest'
import { createOrderSeed } from '../data/orderFixtures'
import { canTransitionOrder, countOrdersByStatus, expirePendingOrders, filterOrders, formatOrderCountdown, formatOrderMoney, getOrderStatusLabel, transitionOrder } from './orderModel'

describe('orderModel', () => {
  const now = 2_000_000_000_000
  const orders = createOrderSeed(now)

  it('金额只按 cents 格式化，倒计时不出现负数', () => {
    expect(formatOrderMoney(153_600)).toBe('¥1,536')
    expect(formatOrderMoney(12_345)).toBe('¥123.45')
    expect(formatOrderCountdown(now + 61 * 60_000 + 4_000, now)).toBe('01:01:04')
    expect(formatOrderCountdown(now - 1, now)).toBe('00:00')
  })

  it('状态转换只允许单向推进，同状态操作幂等', () => {
    const pending = orders.find((order) => order.status === 'pending')!
    expect(canTransitionOrder('pending', 'paid')).toBe(true)
    expect(canTransitionOrder('paid', 'pending')).toBe(false)
    expect(transitionOrder(pending, 'pending', now)).toBe(pending)
    expect(transitionOrder(pending, 'completed', now)).toBe(pending)
    expect(transitionOrder(pending, 'paid', now)).toMatchObject({ status: 'paid', updatedAt: now })
  })

  it('倒计时到期只把 pending 转为 pay_expired', () => {
    const expiredAt = now + 31 * 60_000
    const next = expirePendingOrders(orders, expiredAt)
    expect(next).not.toBe(orders)
    expect(next.find((order) => order.id === 'OD20260821000000001')?.status).toBe('pay_expired')
    expect(next.find((order) => order.status === 'binding')).toBeTruthy()
    expect(expirePendingOrders(next, expiredAt)).toBe(next)
  })

  it('买卖角色、状态组和关键词筛选均源自同一状态字段', () => {
    expect(filterOrders(orders, { role: 'buyer', status: 'trading' })).toHaveLength(2)
    expect(countOrdersByStatus(orders, 'seller', 'trading')).toBe(2)
    expect(filterOrders(orders, { query: 'OD20260821000000001' })[0]?.status).toBe('pending')
    expect(filterOrders(orders, { query: '三角洲' })[0]?.role).toBe('seller')
    expect(getOrderStatusLabel('binding', 'seller')).toBe('待你换绑')
  })
})
