import { describe, expect, it } from 'vitest'
import { createProfileOrders } from '../data/profileFixtures'
import { buildOrderRoute, countOrders, formatCountdown, formatMoney, getPendingOrders, getRemainingSeconds } from './profileModel'

describe('profileModel', () => {
  it('以整数分格式化金额', () => {
    expect(formatMoney(0)).toBe('¥0.00')
    expect(formatMoney(12345)).toBe('¥123.45')
  })

  it('从同一订单 fixture 聚合状态与两件待处理', () => {
    const orders = createProfileOrders(1_000_000)
    expect(countOrders(orders, 'buyer', 'pending')).toBe(1)
    expect(countOrders(orders, 'buyer', 'binding')).toBe(1)
    expect(countOrders(orders, 'buyer', 'bind_success')).toBe(1)
    expect(countOrders(orders, 'buyer', 'aftersale')).toBe(0)
    expect(countOrders(orders, 'seller', 'on_sale')).toBe(1)
    expect(getPendingOrders(orders)).toHaveLength(2)
  })

  it('倒计时逐秒递减并在零点归零', () => {
    const start = 1_000_000
    const pending = createProfileOrders(start)[0]
    expect(formatCountdown(pending.expiresAt, start)).toBe('24:12')
    expect(formatCountdown(pending.expiresAt, start + 1000)).toBe('24:11')
    expect(getRemainingSeconds(pending.expiresAt, start + 2_000_000)).toBe(0)
    expect(formatCountdown(pending.expiresAt, start + 2_000_000)).toBe('已超时')
  })

  it('订单路由映射保留角色与状态', () => {
    expect(buildOrderRoute('buyer', 'pending')).toBe('/orders?role=buyer&status=pending')
    expect(buildOrderRoute('seller')).toBe('/orders?role=seller')
  })
})
