import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LinkedDetailFieldView, LinkedDetailView, LinkedPublishSnapshot } from '../../../双端演示/src/contract'
import { LinkedCurrentDetailCard, LinkedSubmissionSnapshot } from './LinkedDetailCards'

const field = (overrides: Partial<LinkedDetailFieldView> = {}): LinkedDetailFieldView => ({
  fieldKey: 'costume_count', logicalKey: 'costume_count', label: '时装数量', uiType: 'STAT', displayValue: '0',
  provided: true, unit: '件', highlighted: true, style: { fontSize: 'LARGE', bold: true, color: '#123456' }, ...overrides,
})

const configuredView = (): LinkedDetailView => ({
  mode: 'CONFIGURED', gameCode: 'dwrg', versionId: 'detail-v2', versionNo: 2, schemaHash: 'detail-hash',
  dataMode: 'SNAPSHOT', factVersionId: 'publish-v1', factSchemaHash: 'publish-hash', issues: [],
  sections: [
    { sectionKey: 'info', title: '概览', description: '当前标签', displayType: 'INFO_GRID', fields: [field()] },
    { sectionKey: 'tags', title: '亮点', description: '', displayType: 'HIGHLIGHT_TAGS', fields: [field({ fieldKey: 'tag' })] },
    { sectionKey: 'table', title: '资料表', description: '', displayType: 'DESCRIPTION_TABLE', fields: [field({ fieldKey: 'row' })] },
    { sectionKey: 'stats', title: '资产', description: '', displayType: 'ASSET_STATS', fields: [field({ fieldKey: 'stat' })] },
  ],
})

describe('linked detail cards', () => {
  it('renders all frozen layouts, styles and a provided numeric zero with its unit', () => {
    const html = renderToStaticMarkup(<LinkedCurrentDetailCard view={configuredView()} />)
    expect(html).toContain('linked-detail-info-grid')
    expect(html).toContain('linked-detail-highlight-tags')
    expect(html).toContain('linked-detail-description-table')
    expect(html).toContain('linked-detail-asset-stats')
    expect(html).toContain('style="color:#123456;font-size:18px;font-weight:700"')
    expect(html).toContain('<span>0</span><small>件</small>')
    expect(html.indexOf('概览')).toBeLessThan(html.indexOf('亮点'))
  })

  it('keeps configured dark text explicit inside the asset stats layout', () => {
    const view = configuredView()
    view.sections = [{ sectionKey: 'stats', title: '资产', description: '', displayType: 'ASSET_STATS', fields: [field({ style: { fontSize: 'MEDIUM', bold: false, color: '#111827' } })] }]
    const html = renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)
    expect(html).toContain('linked-detail-asset-stats')
    expect(html).toContain('style="color:#111827;font-size:14px;font-weight:400"')
  })

  it('does not append a unit to an unprovided empty-policy value', () => {
    const view = configuredView()
    view.sections = [{ sectionKey: 'empty', title: '空值', description: '', displayType: 'INFO_GRID', fields: [field({ provided: false, displayValue: '—' })] }]
    const html = renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)
    expect(html).toContain('<span>—</span>')
    expect(html).not.toContain('<small>件</small>')
  })

  it('renders every supported display uiType with distinct semantics and classes', () => {
    const view = configuredView()
    view.sections = [{ sectionKey: 'ui-types', title: '显示方式', description: '', displayType: 'INFO_GRID', fields: [
      field({ fieldKey: 'text', uiType: 'TEXT' }),
      field({ fieldKey: 'tag', uiType: 'TAG' }),
      field({ fieldKey: 'stat', uiType: 'STAT' }),
      field({ fieldKey: 'row', uiType: 'TABLE_ROW' }),
    ] }]
    const html = renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)
    expect(html).toContain('linked-detail-value is-ui-text')
    expect(html).toContain('linked-detail-value is-ui-tag')
    expect(html).toContain('<strong class="linked-detail-value is-ui-stat"')
    expect(html).toContain('linked-detail-value is-ui-table-row')
  })

  it('does not silently render an unsupported display uiType as ordinary text', () => {
    const view = configuredView()
    view.sections = [{ ...view.sections[0], fields: [field({ uiType: 'UNKNOWN' })] }]
    const html = renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)
    expect(html).toContain('is-ui-unsupported')
    expect(html).toContain('显示方式不可用')
    expect(html).not.toContain('<span>0</span>')
  })

  it('surfaces configured fact warnings instead of silently presenting an invalid value', () => {
    const view = configuredView()
    view.issues = ['系统平台：提交值不可核验，按缺失处理']
    expect(renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)).toContain(view.issues[0])
  })

  it.each([
    ['MISSING', '暂无已发布详情配置'],
    ['BLOCKED', '详情配置不可用'],
    ['DISABLED', '详情配置已停用'],
  ] as const)('keeps the basic detail visible when mode is %s', (mode, expected) => {
    const view = { ...configuredView(), mode, sections: [], issues: mode === 'BLOCKED' ? ['字典不完整'] : [] }
    expect(renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)).toContain(expected)
  })

  it('shows an explicit unavailable state when no matching fact snapshot exists', () => {
    const view = { ...configuredView(), dataMode: 'UNAVAILABLE' as const, sections: [] }
    expect(renderToStaticMarkup(<LinkedCurrentDetailCard view={view} />)).toContain('尚无与配置基线一致的可核验提交资料')
  })

  it('keeps immutable submission labels and values in a separate collapsed disclosure', () => {
    const snapshot: LinkedPublishSnapshot = {
      versionId: 'publish-old', baseConfigVersionId: 'base-old', schemaHash: 'hash-old', sections: [{ sectionKey: 'old', title: '旧资料', sortOrder: 1, fields: [
        { fieldKey: 'old-os', logicalKey: 'operating_system', sourceId: 'os', label: '提交时系统标签', valueType: 'ENUM', uiType: 'SELECT', required: false, sortOrder: 1, provided: true, value: 'ios', displayValue: '历史 iOS 文案' },
      ] }],
    }
    const html = renderToStaticMarkup(<LinkedSubmissionSnapshot snapshot={snapshot} />)
    expect(html).toContain('<details class="linked-submission-snapshot"><summary>')
    expect(html).toContain('提交时系统标签')
    expect(html).toContain('历史 iOS 文案')
    expect(html).toContain('已提供 1 项')
  })

  it('states explicitly when no immutable submission snapshot exists', () => {
    expect(renderToStaticMarkup(<LinkedSubmissionSnapshot snapshot={undefined} />)).toContain('尚无可核验的提交快照')
  })
})
