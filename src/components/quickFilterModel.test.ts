import { describe, expect, it } from 'vitest'
import { getPricePreset, getServerOption, getToolbarActiveState, hasInvalidPriceRange, serverPlatforms, sortOptions } from './quickFilterModel'

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
    ['sort', { sort: true, server: false, price: false }],
    ['server', { sort: false, server: true, price: false }],
    ['price', { sort: false, server: false, price: true }],
  ] as const)('工具栏选择 %s 时仅一个主项 active', (selection, expected) => {
    const state = getToolbarActiveState(selection)
    expect(state).toEqual(expected)
    expect(Object.values(state).filter(Boolean)).toHaveLength(1)
    expect(state[selection]).toBe(true)
  })

  it('提供和数据层契约一致的四种排序方式', () => {
    expect(sortOptions).toEqual([
      { value: 'default', label: '综合' },
      { value: 'listed_at_desc', label: '最新' },
      { value: 'price_asc', label: '价格升序' },
      { value: 'price_desc', label: '价格降序' },
    ])
  })
})
