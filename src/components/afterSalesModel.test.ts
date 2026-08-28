import { describe, expect, it } from 'vitest'
import { afterSalesFixtures } from '../data/afterSalesFixtures'
import { countAfterSales, filterAfterSales, getAfterSaleStatusLabel, isAfterSaleTab } from './afterSalesModel'

describe('afterSalesModel', () => {
  it('按状态和关键词筛选售后订单', () => {
    expect(filterAfterSales(afterSalesFixtures, 'pending_review', '')).toHaveLength(1)
    expect(filterAfterSales(afterSalesFixtures, 'all', 'OD20260821000000002')[0]?.status).toBe('supplement')
    expect(filterAfterSales(afterSalesFixtures, 'all', '王者荣耀')).toHaveLength(2)
  })

  it('提供页签判断、数量和状态文案', () => {
    expect(isAfterSaleTab('refunding')).toBe(true)
    expect(isAfterSaleTab('unknown')).toBe(false)
    expect(countAfterSales(afterSalesFixtures, 'all')).toBe(6)
    expect(getAfterSaleStatusLabel('platform_processing')).toBe('平台处理中')
  })
})
