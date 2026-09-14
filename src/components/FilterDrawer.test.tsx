import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FilterDrawer } from './FilterDrawer'
import { advancedFilterSections } from './advancedFilterModel'
import { emptyFilters, type ProductFilters } from '../types/catalog'

const render = (filters: ProductFilters = { ...emptyFilters }, count = 13) => renderToStaticMarkup(<FilterDrawer open filters={filters} onClose={vi.fn()} onApply={vi.fn()} resultCounter={() => count} />)

describe('advanced filter design structure', () => {
  it('renders every section together, in the new design order, with matching navigation anchors', () => {
    const html = render()
    let previousIndex = -1
    for (const { key, label } of advancedFilterSections) {
      expect(html).toContain(`aria-controls="filter-section-${key}"`)
      expect(html).toContain(`<h3 id="filter-heading-${key}" data-ui="Heading"`)
      expect(html).toContain(`>${label}</h3>`)
      const index = html.indexOf(`id="filter-section-${key}"`)
      expect(index).toBeGreaterThan(previousIndex)
      previousIndex = index
    }
    expect(html.match(/class="advanced-filter-section"/g)).toHaveLength(7)
    expect(html).not.toContain('热门条件')
    expect(html).not.toContain('安全条件优先')
    expect(html).not.toContain('已恢复上次条件')
  })

  it('starts without the example selections from the Figma screenshot', () => {
    const html = render()
    expect(html).not.toContain('aria-pressed="true"')
    expect(html).toContain('data-ui="ChoiceChip"')
    expect(html).toContain('data-ui="RangeField"')
    expect(html).toContain('aria-label="皮肤数量最低"')
    expect(html).toContain('aria-label="皮肤数量最高"')
    expect(html).toContain('aria-label="价格最低"')
    expect(html).toContain('aria-label="价格最高"')
    expect(html).toContain('重置全部')
    expect(html).toContain('>查看结果</button>')
    expect(html).not.toContain('查看结果（')
  })

  it('does not replace editable fields with recovery while a zero-result range is being entered', () => {
    const html = render({ ...emptyFilters, minPrice: '99999' }, 0)
    expect(html).toContain('value="99999"')
    expect(html).toContain('aria-label="价格最高"')
    expect(html).not.toContain('当前条件暂无匹配账号')
    expect(html).not.toContain('disabled=""')
  })

  it('keeps invalid ranges editable and blocks confirmation with a described error', () => {
    for (const filters of [{ ...emptyFilters, minPrice: '200', maxPrice: '100' }, { ...emptyFilters, minSkin: '300', maxSkin: '100' }]) {
      const html = render(filters, 0)
      expect(html).toContain('aria-invalid="true"')
      expect(html).toContain('最低值不能高于最高值')
      expect(html).toMatch(/data-ui="Button"[^>]*class="[^"]*advanced-filter-submit[^"]*"[^>]*disabled=""/)
    }
  })

  it('restores applied booleans and values arriving from search', () => {
    const html = render({ ...emptyFilters, secondRealName: 'false', faceCompensation: 'true', ranks: ['搜索中的段位'] })
    for (const label of ['不支持', '支持', '搜索中的段位']) {
      expect(html).toMatch(new RegExp(`data-ui="ChoiceChip"[^>]*aria-pressed="true"[^>]*>[\\s\\S]*?${label}</button>`))
    }
    expect(html).not.toContain('选择皮肤')
    expect(html).not.toContain('皮肤匹配方式')
  })

  it('uses the designated anchor for skin count and stays unmounted when closed', () => {
    const props = { filters: { ...emptyFilters }, onClose: vi.fn(), onApply: vi.fn() }
    expect(renderToStaticMarkup(<FilterDrawer {...props} open initialSection="skinCount" />)).toContain('data-filter-anchor="skinCount" aria-current="location"')
    expect(renderToStaticMarkup(<FilterDrawer {...props} open={false} />)).toBe('')
  })
})
