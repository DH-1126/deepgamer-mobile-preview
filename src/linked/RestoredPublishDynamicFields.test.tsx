import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RestoredPublishDynamicFields, setRestoredPublishOption } from './RestoredPublishDynamicFields'
import type { RestoredPublishForm } from './restoredPublish'

const rank = { fieldId: 'rank', sourceType: 'ATTRIBUTE', sourceKey: 'rank', label: '段位', valueType: 'ENUM', uiType: 'SELECT', cardinality: 'ONE', required: true, validation: {}, options: [{ key: 'rank:king', label: '王者' }] } as const
const heroes = { fieldId: 'heroes', sourceType: 'GROUP', sourceKey: 'heroes', label: '英雄', valueType: 'GROUP_SET', uiType: 'CHECKBOX', cardinality: 'MANY', required: false, validation: { maxItems: 2 }, options: [{ key: 'hero:1', label: '英雄一' }, { key: 'hero:2', label: '英雄二' }] } as const
const form: RestoredPublishForm = {
  gameCode: 'wzry', gameName: '王者荣耀', publishRevisionId: 'revision-1', publishSnapshotId: 'snapshot-1', configVersionId: 'config-1', schemaHash: 'schema-1',
  fields: { rank, heroes },
  steps: [{ stepId: 'one', name: '基础资料', fields: [rank] }, { stepId: 'two', name: '英雄资产', fields: [rank, heroes] }],
}

describe('restored publish dynamic fields', () => {
  it('renders one complete step at a time and retains the shared fieldId value', () => {
    const html = renderToStaticMarkup(<RestoredPublishDynamicFields form={form} values={{ rank: 'rank:king' }} disabled={false} activeStep={1} onActiveStepChange={() => {}} onChange={() => {}} />)
    expect(html).toContain('第 2/2 步')
    expect(html).toContain('英雄资产')
    expect(html).toContain('value="rank:king" selected=""')
  })

  it('keeps frozen fullKeys in directory order while toggling a multi-select value', () => {
    expect(setRestoredPublishOption(heroes, ['hero:2'], 'hero:1')).toEqual(['hero:1', 'hero:2'])
    expect(setRestoredPublishOption(heroes, ['hero:1', 'hero:2'], 'hero:1')).toEqual(['hero:2'])
  })

  it('renders each supported GOODS_FIELD with its core control and keeps BOOLEAN explicitly unfilled', () => {
    const coreFields = [
      { ...rank, fieldId: 'title', sourceType: 'GOODS_FIELD', sourceKey: 'title', label: '标题', valueType: 'GOODS_FIELD', uiType: 'INPUT', options: [] },
      { ...rank, fieldId: 'description', sourceType: 'GOODS_FIELD', sourceKey: 'description', label: '描述', valueType: 'GOODS_FIELD', uiType: 'TEXTAREA', options: [] },
      { ...rank, fieldId: 'price', sourceType: 'GOODS_FIELD', sourceKey: 'price', label: '售价', valueType: 'GOODS_FIELD', uiType: 'NUMBER', validation: { min: 100, max: 50_000 }, options: [] },
      { ...rank, fieldId: 'images', sourceType: 'GOODS_FIELD', sourceKey: 'images', label: '商品图片', valueType: 'GOODS_FIELD', uiType: 'IMAGE_UPLOAD', options: [] },
      { ...rank, fieldId: 'transferable', sourceType: 'ATTRIBUTE', sourceKey: 'transferable', label: '可换绑', valueType: 'BOOLEAN', uiType: 'SWITCH', options: [] },
    ] as unknown as RestoredPublishForm['steps'][number]['fields']
    const coreForm = { ...form, fields: Object.fromEntries(coreFields.map(field => [field.fieldId, field])), steps: [{ stepId: 'core', name: '核心资料', fields: coreFields }] }
    const html = renderToStaticMarkup(<RestoredPublishDynamicFields
      form={coreForm} values={{ title: '合成标题', description: '合成描述', price: 12300 }} disabled={false} activeStep={0}
      onActiveStepChange={() => {}} onChange={() => {}} renderGoodsMediaField={() => <span data-media-field="true">选择商品图片</span>} />)
    expect(html).toContain('value="合成标题"')
    expect(html).toContain('<textarea')
    expect(html).toContain('value="123"')
    expect(html).toContain('min="1"')
    expect(html).toContain('max="500"')
    expect(html).toContain('data-media-field="true"')
    expect(html).toContain('未填写')
    expect(html).toContain('是')
    expect(html).toContain('否')
  })
})
