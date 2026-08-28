import { describe, expect, it } from 'vitest'
import { createOrderSeed } from '../data/orderFixtures'
import { createRecycleOrder } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { countRecycleOrders, countTradeOrders, filterRecycleOrders, filterTradeOrders, formatEntryBadge, getActionableRecycleOrders, getActionableTradeOrders, getRecycleOrderStatusLabel } from './orderHubModel'

describe('orderHubModel', () => {
  const now = 2_000_000_000_000
  const orders = createOrderSeed(now)

  it('买入和卖出使用各自状态分组', () => {
    expect(countTradeOrders(orders, 'buyer', 'pending')).toBe(1)
    expect(countTradeOrders(orders, 'buyer', 'trading')).toBe(1)
    expect(countTradeOrders(orders, 'buyer', 'bind_success')).toBe(1)
    expect(countTradeOrders(orders, 'seller', 'binding')).toBe(1)
    expect(countTradeOrders(orders, 'seller', 'trading')).toBe(1)
  })

  it('订单搜索覆盖订单号、商品号、标题、游戏和区服', () => {
    expect(filterTradeOrders(orders, 'buyer', 'all', 'p02')[0]?.productId).toBe('p02')
    expect(filterTradeOrders(orders, 'seller', 'all', '三角洲')).toHaveLength(1)
    expect(filterTradeOrders(orders, 'buyer', 'all', '不存在')).toEqual([])
  })

  it('待处理角标只统计需要用户动作的订单', () => {
    expect(getActionableTradeOrders(orders, 'buyer')).toHaveLength(2)
    expect(getActionableTradeOrders(orders, 'seller')).toHaveLength(1)
    expect(formatEntryBadge(0)).toBe('')
    expect(formatEntryBadge(100)).toBe('99+')
  })

  it('回收单按待处理、处理中、完成和结束筛选并支持搜索', () => {
    const base = createRecycleOrder(recyclerFixtures[0]!, now)
    const recycleOrders = [
      { ...base, id: 'RC-PENDING', stage: 'formal' as const },
      { ...base, id: 'RC-PROCESS', stage: 'inspecting' as const },
      { ...base, id: 'RC-DONE', stage: 'completed' as const },
      { ...base, id: 'RC-END', stage: 'rejected' as const },
    ]
    expect(countRecycleOrders(recycleOrders, 'pending')).toBe(1)
    expect(countRecycleOrders(recycleOrders, 'processing')).toBe(1)
    expect(getActionableRecycleOrders(recycleOrders)).toHaveLength(1)
    expect(filterRecycleOrders(recycleOrders, 'all', '真趣')).toHaveLength(4)
    expect(getRecycleOrderStatusLabel(recycleOrders[0])).toBe('待确认')
  })
})
