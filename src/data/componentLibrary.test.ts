import { describe, expect, it } from 'vitest'
import { componentCategories, componentSourceUrl, componentSpecs, filterComponentSpecs } from './componentLibrary'
import * as sharedComponents from '../components/ui'

describe('component library catalog', () => {
  it('documents every shared primitive and keeps all entries unique', () => {
    for (const id of Object.keys(sharedComponents)) expect(componentSpecs.some(spec => spec.id === id), `${id} 必须有规范和示例`).toBe(true)
    const primitives = ['Heading', 'SectionHeader', 'Button', 'IconButton', 'FilterTrigger', 'ChoiceChip', 'TextField', 'SearchField', 'RangeField', 'Tabs', 'ToggleSwitch', 'Checkbox', 'StatusBadge', 'CountBadge', 'InlineNotice', 'Cell', 'EmptyStateView', 'Dialog', 'BottomSheet', 'FullScreenPanel', 'ImagePreview', 'Toast', 'MetricGrid', 'InfoList', 'ProductActionBar', 'SellerSummary', 'AssetInventory', 'ConversationRow', 'RecycleConversationRow']
    for (const id of primitives) expect(componentSpecs.some(spec => spec.id === id)).toBe(true)
    expect(new Set(componentSpecs.map(spec => spec.id)).size).toBe(componentSpecs.length)
    for (const spec of componentSpecs) {
      expect(componentCategories.some(category => category.value === spec.category)).toBe(true)
      expect(spec.rules.length).toBeGreaterThan(0)
      expect(spec.example.length).toBeGreaterThan(0)
      if (spec.source) expect(componentSourceUrl(spec.source)).toContain('https://www.figma.com/design/Ai4LTD0KcInZyiTfXrvlvn?node-id=')
    }
  })

  it('searches names, English APIs, usage and multiple keywords without changing data', () => {
    expect(filterComponentSpecs('all', '  SEARCHfield  ').map(item => item.id)).toEqual(['SearchField'])
    expect(filterComponentSpecs('all', '登录 52').map(item => item.id)).toContain('Button')
    expect(filterComponentSpecs('all', '筛选').map(item => item.id)).toContain('ChoiceChip')
    expect(filterComponentSpecs('typography', 'sectionheader').map(item => item.id)).toEqual(['SectionHeader'])
    expect(filterComponentSpecs('all', '卖家 两行').map(item => item.id)).toContain('SellerSummary')
    expect(filterComponentSpecs('business', '消息 平台客服').map(item => item.id)).toContain('ConversationRow')
    expect(filterComponentSpecs('display', '提示条').map(item => item.id)).toEqual(['InlineNotice'])
    expect(filterComponentSpecs('feedback', '')).toHaveLength(5)
    expect(filterComponentSpecs('feedback', '登录')).toEqual([])
    expect(filterComponentSpecs('all', 'zz-no-such-component')).toEqual([])
    expect(filterComponentSpecs('all', '').length).toBe(componentSpecs.length)
  })
})
