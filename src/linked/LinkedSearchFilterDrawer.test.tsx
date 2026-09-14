import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LinkedSearchProjection } from '../../../双端演示/src/contract'
import { getLinkedSearchGroupOptionPage, LinkedSearchFilterDrawer, LINKED_SEARCH_GROUP_PAGE_SIZE } from './LinkedSearchFilterDrawer'

const costumeOptions = Array.from({ length: 45 }, (_, index) => ({
  id: `costume-${String(index + 1).padStart(3, '0')}`,
  fullKey: `group:costume-${String(index + 1).padStart(3, '0')}`,
  name: `稀世时装${String(index + 1).padStart(3, '0')}`,
  sortOrder: index + 1,
}))

const projection: LinkedSearchProjection = {
  mode: 'CONFIGURED', gameCode: 'dwrg', gameId: 'game-dwrg', versionId: 'search-v1', versionNo: 1,
  baseConfigVersionId: 'base-v1', schemaHash: 'hash-v1', evidenceHash: 'evidence-v1',
  coverage: { sourceActiveCount: 4, includedCount: 4, excludedCount: 0 }, excludedFields: [], issues: [],
  fields: [
    { id: 'os', fieldKey: 'os', label: '操作系统', sourceId: 'a-os', logicalKey: 'operating_system', valueType: 'ENUM', scene: 'SINGLE', operator: 'IN', isPrimary: true, sortOrder: 1, options: [{ id: 'ios', fullKey: 'ios', name: 'iOS', sortOrder: 1 }] },
    { id: 'count', fieldKey: 'count', label: '时装数量', sourceId: 'a-count', logicalKey: 'costume_count', valueType: 'NUMBER', scene: 'RANGE', operator: 'BETWEEN', isPrimary: false, sortOrder: 2, options: [] },
    { id: 'rebind', fieldKey: 'rebind', label: '是否可二次实名', sourceId: 'a-rebind', logicalKey: 'can_change_real_name', valueType: 'BOOLEAN', scene: 'BOOLEAN', operator: 'IN', isPrimary: true, sortOrder: 3, options: [] },
    {
      id: 'costumes', fieldKey: 'costumes', label: '稀世时装', sourceId: 'group-costumes', logicalKey: 'g:dwrg_rare_costumes',
      sourceType: 'GROUP', sourceKey: 'g:dwrg_rare_costumes', valueType: 'ENUM', scene: 'GROUP_MULTI', operator: 'IN',
      allowedMatchModes: ['ALL', 'ANY'], defaultMatchMode: 'ALL', matchRuleEvidenceId: 'online-match-rule-20260914',
      isPrimary: true, sortOrder: 4, options: costumeOptions,
    },
  ],
}

const render = (overrides: Partial<Parameters<typeof LinkedSearchFilterDrawer>[0]> = {}) => renderToStaticMarkup(<LinkedSearchFilterDrawer
  open gameName="第五人格" projection={projection} currentProjection={projection} values={{}} conflict=""
  onClose={vi.fn()} onApply={vi.fn()} onApplyLatest={vi.fn()} {...overrides}
/>)

describe('linked search filter drawer', () => {
  it('renders configured enum and number fields with existing drawer dimensions and decimal ranges', () => {
    const html = render({ values: { count: { min: '0', max: '15' } } })
    expect(html).toContain('advanced-filter-sheet')
    expect(html).toContain('操作系统')
    expect(html).toContain('>iOS</button>')
    expect(html).toContain('type="number" step="any"')
    expect(html).toContain('value="0"')
    expect(html).not.toContain('皮肤数量')
    expect(html).not.toContain('游戏区服')
  })

  it('renders primary fields before non-primary fields and uses the first sorted field as active', () => {
    const [primary, normal] = projection.fields
    const reordered = {
      ...projection,
      fields: [
        { ...normal, id: 'normal-first-input', label: '普通字段', sortOrder: 1 },
        { ...primary, id: 'primary-later-input', label: '主要字段', sortOrder: 9 },
      ],
    }
    const html = render({ projection: reordered, currentProjection: reordered })
    expect(html.indexOf('主要字段')).toBeLessThan(html.indexOf('普通字段'))
    expect(html).toContain('aria-current="location" aria-controls="linked-search-field-primary-later-input"')
  })

  it('renders boolean choices and keeps false visible in SSR conflict details', () => {
    const regular = render({ values: { rebind: { booleanValue: false } } })
    expect(regular).toContain('不限</button>')
    expect(regular).toContain('是</button>')
    expect(regular).toContain('否</button>')
    expect(regular).toMatch(/aria-pressed="true"[^>]*>否<\/button>/)

    const conflict = render({ values: { rebind: { booleanValue: false } }, conflict: '管理端已发布新版本' })
    expect(conflict).toContain('<strong>是否可二次实名</strong><span>否</span>')
    expect(conflict).toContain('应用最新筛选')
  })

  it('renders group mode, search, selected cross-page values, and only one 20-item page', () => {
    const html = render({ values: { costumes: { optionIds: ['costume-025'], matchMode: 'ANY' } } })
    expect(html).toContain('aria-label="稀世时装匹配方式"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>任一<\/button>/)
    expect(html).toContain('type="search"')
    expect(html).toContain('aria-label="搜索稀世时装"')
    expect(html).toContain('已选 1 项')
    expect(html).toContain('aria-label="取消选择稀世时装025"')
    expect(html).toContain('1/3 · 共 45 项')
    expect(html).toContain('>稀世时装020</button>')
    expect(html).not.toContain('>稀世时装021</button>')
  })

  it('filters and paginates large group option dictionaries in deterministic 20-item pages', () => {
    expect(LINKED_SEARCH_GROUP_PAGE_SIZE).toBe(20)
    const secondPage = getLinkedSearchGroupOptionPage(costumeOptions, '', 2)
    expect(secondPage.options).toHaveLength(20)
    expect(secondPage.options[0].id).toBe('costume-021')
    expect(secondPage.options.at(-1)?.id).toBe('costume-040')
    expect(secondPage.pageCount).toBe(3)

    const searched = getLinkedSearchGroupOptionPage(costumeOptions, '025', 99)
    expect(searched).toMatchObject({ total: 1, page: 1, pageCount: 1 })
    expect(searched.options.map((option) => option.id)).toEqual(['costume-025'])
  })

  it('keeps group names and match mode visible in SSR conflict details', () => {
    const html = render({ values: { costumes: { optionIds: ['costume-025', 'costume-001'], matchMode: 'ALL' } }, conflict: '管理端已发布新版本' })
    expect(html).toContain('<strong>稀世时装</strong><span>全部：稀世时装025、稀世时装001</span>')
  })

  it('reports local coverage and keeps exclusions in a collapsible scroll-area disclosure', () => {
    const partial = { ...projection, mode: 'PARTIAL' as const, coverage: { sourceActiveCount: 15, includedCount: 2, excludedCount: 13 }, excludedFields: [{ fieldId: 'old', fieldKey: 'old', label: '未接入字段', reason: 'UNRESOLVED_SOURCE', detail: '缺少可核验来源' }] }
    const html = render({ projection: partial, currentProjection: partial })
    expect(html).toContain('<details class="linked-search-coverage"><summary>本地配置接入 2/15 项 · 部分可用</summary>')
    expect(html).toContain('未接入字段')
    expect(html).toContain('缺少可核验来源')
  })

  it('shows an explicit conflict without silently replacing the selected draft', () => {
    const html = render({ values: { os: { optionId: 'ios' } }, conflict: '管理端已发布新版本' })
    expect(html).toContain('管理端已发布新版本')
    expect(html).toContain('应用最新筛选')
    expect(html).toContain('disabled=""')
  })

  it('keeps an unsubmitted zero draft visible when the current projection changes', () => {
    const currentProjection = { ...projection, versionId: 'search-v2', schemaHash: 'hash-v2' }
    const html = render({ currentProjection, values: { count: { min: '0', max: '' } } })
    expect(html).toContain('筛选配置已变更')
    expect(html).toContain('<strong>时装数量</strong><span>0 至 —</span>')
    expect(html).toContain('应用最新筛选')
    expect(html).toContain('disabled=""')
  })

  it.each([
    ['BLOCKED', '存在缺口'],
    ['MISSING', '尚未发布'],
    ['DISABLED', '搜索字段已全部停用'],
  ] as const)('explains %s without falling back to fixed fields', (mode, expected) => {
    const unavailable = { ...projection, mode, fields: [], issues: ['配置详情'] }
    const html = render({ projection: unavailable, currentProjection: unavailable })
    expect(html).toContain(expected)
    expect(html).toContain('仍可使用关键词、价格和排序')
    expect(html).not.toContain('荣耀王者')
  })
})
