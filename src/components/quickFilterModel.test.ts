import { describe, expect, it } from 'vitest'
import { getPricePreset, getServerOption, getToolbarActiveState, hasInvalidPriceRange, serverPlatforms } from './quickFilterModel'

describe('quickFilterModel', () => {
  it('将区服分组映射到现有平台字段', () => {
    expect(getServerOption([])).toBe('all')
    expect(getServerOption(['安卓QQ'])).toBe('qq')
    expect(getServerOption(['安卓微信', 'iOS 微信'])).toBe('wechat')
    expect(serverPlatforms.steam).toEqual(['Steam'])
  })

  it('仅在价格完整匹配时同步推荐区间', () => {
    expect(getPricePreset('530', '850')).toBe('530-850')
    expect(getPricePreset('531', '850')).toBeNull()
    expect(getPricePreset('', '')).toBeNull()
  })

  it('拒绝最低价高于最高价的区间', () => {
    expect(hasInvalidPriceRange('2000', '850')).toBe(true)
    expect(hasInvalidPriceRange('850', '2000')).toBe(false)
    expect(hasInvalidPriceRange('850', '')).toBe(false)
  })

  it.each([
    ['default', { default: true, server: false, price: false }],
    ['server', { default: false, server: true, price: false }],
    ['price', { default: false, server: false, price: true }],
  ] as const)('工具栏选择 %s 时仅一个主项 active', (selection, expected) => {
    const state = getToolbarActiveState(selection)
    expect(state).toEqual(expected)
    expect(Object.values(state).filter(Boolean)).toHaveLength(1)
    expect(state[selection]).toBe(true)
  })
})
