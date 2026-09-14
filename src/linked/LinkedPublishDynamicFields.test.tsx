import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { LinkedPublishForm, LinkedPublishFormField } from '../../../双端演示/src/publish-config'
import { LinkedPublishDynamicFields, filterLinkedPublishOptions, linkedPublishSectionIssues, toggleLinkedPublishOption } from './LinkedPublishDynamicFields'

const options = Array.from({ length: 25 }, (_, index) => ({ id: `costume-${index + 1}`, name: `时装 ${index + 1}` }))
const fields: LinkedPublishFormField[] = [
  { fieldKey: 'channel', logicalKey: 'channel', sourceId: 'channel', label: '渠道', valueType: 'ENUM', uiType: 'RADIO', cardinality: 'ONE', required: true, sortOrder: 1, placeholder: '', helpText: '', validation: {}, options: [{ id: 'official', name: '官服' }, { id: 'channel', name: '渠道服' }] },
  { fieldKey: 'switch', logicalKey: 'switch', sourceId: 'switch', label: '可二次实名', valueType: 'BOOLEAN', uiType: 'SWITCH', cardinality: 'ONE', required: false, sortOrder: 2, placeholder: '', helpText: '', validation: {}, options: [] },
  { fieldKey: 'costumes', logicalKey: 'costumes', sourceId: 'costumes', label: '时装', valueType: 'ENUM', uiType: 'CHECKBOX', cardinality: 'MANY', required: false, sortOrder: 3, placeholder: '', helpText: '', validation: {}, options },
]
const form = (reconstruction = true): LinkedPublishForm => ({
  mode: 'CONFIGURED', gameCode: 'dwrg', versionId: 'publish-v2', schemaHash: 'hash-v2', issues: [],
  ...(reconstruction ? { reconstruction: { onlineVersionStatus: 'VERSION_UNVERIFIED' as const, validationPolicy: 'FIELD_ONLY' as const } } : {}),
  sections: [
    { sectionKey: 'security', title: '渠道与安全', description: '安全信息', sortOrder: 1, requiredObserved: true, requiredSemantics: null, fields },
    { sectionKey: 'progress', title: '账号进度', description: '', sortOrder: 2, fields: [{ ...fields[0], fieldKey: 'rank', label: '段位', required: false }] },
    { sectionKey: 'stats', title: '资产统计', description: '', sortOrder: 3, fields: [{ ...fields[0], fieldKey: 'count', label: '数量', valueType: 'NUMBER', uiType: 'NUMBER', options: [], required: false }] },
    { sectionKey: 'assets', title: '时装资产', description: '', sortOrder: 4, fields: [{ ...fields[2], fieldKey: 'rare', label: '稀世时装', sourceType: 'GROUP', sourceKey: 'g:dwrg_rare_costumes' }] },
  ],
})

const render = (overrides: Partial<Parameters<typeof LinkedPublishDynamicFields>[0]> = {}) => renderToStaticMarkup(<LinkedPublishDynamicFields
  form={form()} values={{}} disabled={false} activeStep={0} onActiveStepChange={vi.fn()} onChange={vi.fn()} {...overrides}
/>)

describe('linked publish dynamic fields', () => {
  it('renders the reconstructed form as a four-step wizard with semantic radio, switch and checkbox controls', () => {
    const html = render({ values: { switch: false, costumes: ['costume-1', 'costume-21'] } })
    expect(html).toContain('第 1/4 步')
    expect(html).toContain('type="radio"')
    expect(html).toContain('role="switch" aria-checked="false"')
    expect(html).toContain('<b>否</b>')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('已选 2 项')
    expect(html).toContain('时装 20')
    expect(html).not.toContain('时装 21</span>')
    expect(html).toContain('下一页')
    expect(html).toContain('本地仅按具体字段的必填标记校验')
  })

  it('keeps the original all-section layout when reconstruction metadata is absent', () => {
    const html = render({ form: form(false) })
    expect(html).not.toContain('发布资料步骤')
    expect(html).toContain('渠道与安全')
    expect(html).toContain('账号进度')
    expect(html).toContain('资产统计')
    expect(html).toContain('时装资产')
  })

  it('shows the final-review state only on the last wizard step', () => {
    expect(render({ activeStep: 2 })).toContain('下一步')
    const last = render({ activeStep: 3 })
    expect(last).toContain('游戏资料已完成，请核对后提交审核')
    expect(last).not.toContain('>下一步</button>')
  })

  it('validates only required fields and treats false as provided', () => {
    const section = form().sections[0]
    expect(linkedPublishSectionIssues(section, { channel: 'official', switch: false })).toEqual([])
    expect(linkedPublishSectionIssues(section, { switch: false })).toEqual(['请填写渠道'])
    expect(linkedPublishSectionIssues({ ...section, fields: section.fields.map((field) => ({ ...field, required: false })) }, {})).toEqual([])
  })

  it('filters by option name and preserves selections across option pages in configured order', () => {
    const field = fields[2]
    expect(filterLinkedPublishOptions(field, '时装 21').map((option) => option.id)).toEqual(['costume-21'])
    const first = toggleLinkedPublishOption(field, [], 'costume-21')
    expect(toggleLinkedPublishOption(field, first, 'costume-1')).toEqual(['costume-1', 'costume-21'])
  })
})
