import { describe, expect, it } from 'vitest'
import {
  buildRestoredPublishForm,
  collectRestoredGoodsFields,
  validateRestoredPublishSubmission,
  type RestoredGoodsDraftValues,
} from './restoredPublish'

const directory = {
  gameId: 'game-wzry', gameCode: 'wzry', gameName: '王者荣耀',
  publishRevisionId: 'revision-3', publishSnapshotId: 'snapshot-3',
  configVersionId: 'config-2', schemaHash: 'schema-3',
  fields: [
    { fieldId: 'rank', sourceType: 'ATTRIBUTE', sourceKey: 'rank', label: '段位', valueType: 'ENUM', uiType: 'SELECT', cardinality: 'ONE', required: true, validation: {}, options: [{ key: 'rank:king', label: '王者' }] },
    { fieldId: 'heroes', sourceType: 'GROUP', sourceKey: 'heroes', label: '英雄', valueType: 'GROUP_SET', uiType: 'CHECKBOX', cardinality: 'MANY', required: false, validation: { maxItems: 2 }, options: [{ key: 'hero:1', label: '英雄一' }, { key: 'hero:2', label: '英雄二' }] },
    { fieldId: 'price', sourceType: 'GOODS_FIELD', sourceKey: 'price', label: '售价', valueType: 'GOODS_FIELD', uiType: 'NUMBER', cardinality: 'ONE', required: true, validation: { min: 100 }, options: [] },
  ],
} as const

const publicConfig = {
  gameCode: 'wzry', scope: 'PUBLISH', revisionId: 'revision-3', snapshotId: 'snapshot-3',
  configVersionId: 'config-2', schemaHash: 'schema-3',
  compiled: {
    definitionVersion: 'publish-v2',
    scenes: [{
      fieldSceneType: 'goods_publish',
      fields: [
        { fieldId: 'rank', sourceType: 'ATTRIBUTE', sourceKey: 'rank', label: '段位', uiType: 'SELECT', status: 'ACTIVE' },
        { fieldId: 'heroes', sourceType: 'GROUP', sourceKey: 'heroes', label: '英雄', uiType: 'CHECKBOX', status: 'ACTIVE' },
        { fieldId: 'price', sourceType: 'GOODS_FIELD', sourceKey: 'price', label: '售价', uiType: 'NUMBER', status: 'ACTIVE' },
        { fieldId: 'unmounted', sourceType: 'ATTRIBUTE', sourceKey: 'unused', label: '未挂载', uiType: 'INPUT', status: 'ACTIVE' },
      ],
      steps: [
        { stepId: 'account', name: '账号信息', sortOrder: 20, status: 'ACTIVE', fieldIds: ['rank', 'heroes'] },
        { stepId: 'pricing', name: '价格确认', sortOrder: 10, status: 'ACTIVE', fieldIds: ['price', 'rank'] },
        { stepId: 'hidden', name: '已停用', sortOrder: 0, status: 'DISABLED', fieldIds: ['unmounted'] },
      ],
    }],
  },
} as const

describe('restored full PUBLISH projection', () => {
  it('requires all four frozen identifiers and preserves active step order with shared field identity', () => {
    const form = buildRestoredPublishForm(directory, publicConfig)
    expect(form.steps.map(step => step.name)).toEqual(['价格确认', '账号信息'])
    expect(form.steps.map(step => step.fields.map(field => field.fieldId))).toEqual([['price', 'rank'], ['rank', 'heroes']])
    expect(form.fields.rank).toBe(form.steps[0].fields[1])
    expect(form.fields.rank).toBe(form.steps[1].fields[0])
    expect(form.fields.unmounted).toBeUndefined()

    for (const [key, value] of Object.entries({ revisionId: 'other', snapshotId: 'other', configVersionId: 'other', schemaHash: 'other' })) {
      expect(() => buildRestoredPublishForm(directory, { ...publicConfig, [key]: value })).toThrow(/PUBLISH 配置已变更/)
    }
    expect(() => buildRestoredPublishForm(directory, { ...publicConfig, revisionId: undefined })).toThrow(/缺少发布修订标识/)
  })

  it('keeps legacy FORM_STEP structure instead of flattening the directory', () => {
    const legacy = {
      ...publicConfig,
      compiled: { template: { templateType: 'PUBLISH', status: 'ACTIVE', sections: [
        { id: 'legacy-two', title: '第二步', displayType: 'FORM_STEP', sortOrder: 20, status: 'ACTIVE', fields: [{ id: 'heroes', sourceType: 'GROUP', sourceKey: 'heroes', label: '英雄', uiType: 'CHECKBOX', status: 'ACTIVE' }] },
        { id: 'legacy-one', title: '第一步', displayType: 'FORM_STEP', sortOrder: 10, status: 'ACTIVE', fields: [{ id: 'rank', sourceType: 'ATTRIBUTE', sourceKey: 'rank', label: '段位', uiType: 'SELECT', status: 'ACTIVE' }, { id: 'price', sourceType: 'GOODS_FIELD', sourceKey: 'price', label: '售价', uiType: 'NUMBER', status: 'ACTIVE' }] },
      ] } },
    }
    expect(buildRestoredPublishForm(directory, legacy).steps.map(step => step.name)).toEqual(['第一步', '第二步'])
  })

  it('accepts legal legacy fields whose frozen source is identified by sourceId instead of sourceKey', () => {
    const legacyDirectory = { ...directory, fields: directory.fields.slice(0, 2) }
    const legacy = {
      ...publicConfig,
      compiled: { template: { templateType: 'PUBLISH', status: 'ACTIVE', sections: [{
        id: 'legacy-account', title: '账号信息', displayType: 'FORM_STEP', sortOrder: 10, status: 'ACTIVE',
        fields: [
          { id: 'rank', fieldKey: 'rank', sourceType: 'ATTRIBUTE', sourceId: 'attribute-rank', label: '段位', uiType: 'SELECT', status: 'ACTIVE' },
          { id: 'heroes', fieldKey: 'heroes', sourceType: 'GROUP', sourceId: 'group-heroes', label: '英雄', uiType: 'CHECKBOX', status: 'ACTIVE' },
        ],
      }] } },
    }
    const form = buildRestoredPublishForm(legacyDirectory, legacy)
    expect(form.steps.map(step => step.fields.map(field => field.sourceKey))).toEqual([['rank', 'heroes']])
    const withoutFrozenSource = {
      ...legacy,
      compiled: { template: { ...legacy.compiled.template, sections: [{
        ...legacy.compiled.template.sections[0],
        fields: [{ ...legacy.compiled.template.sections[0].fields[0], sourceId: undefined }, legacy.compiled.template.sections[0].fields[1]],
      }] } },
    }
    expect(() => buildRestoredPublishForm(legacyDirectory, withoutFrozenSource)).toThrow(/来源 ID/)
  })

  it('blocks source collisions, unknown rules, and incomplete mounted layouts', () => {
    const duplicateSource = { ...directory, fields: [...directory.fields, { ...directory.fields[0], fieldId: 'rank-copy' }] }
    expect(() => buildRestoredPublishForm(duplicateSource, publicConfig)).toThrow(/同一来源/)
    const unknownValidation = { ...directory, fields: [{ ...directory.fields[0], validation: { pattern: '.*' } }, ...directory.fields.slice(1)] }
    expect(() => buildRestoredPublishForm(unknownValidation, publicConfig)).toThrow(/不支持的校验规则/)
    const missingMounted = { ...publicConfig, compiled: { ...publicConfig.compiled, scenes: [{ ...publicConfig.compiled.scenes[0], steps: [{ stepId: 'bad', name: '错误', sortOrder: 0, status: 'ACTIVE', fieldIds: ['missing'] }] }] } }
    expect(() => buildRestoredPublishForm(directory, missingMounted)).toThrow(/不存在的字段/)
    const v2MissingSourceKey = { ...publicConfig, compiled: { ...publicConfig.compiled, scenes: [{ ...publicConfig.compiled.scenes[0], fields: [
      { fieldId: 'rank', sourceType: 'ATTRIBUTE', label: '段位', uiType: 'SELECT', status: 'ACTIVE' }, ...publicConfig.compiled.scenes[0].fields.slice(1),
    ] }] } }
    expect(() => buildRestoredPublishForm(directory, v2MissingSourceKey)).toThrow(/字段机器键/)
  })
})

describe('restored publish values', () => {
  const values: RestoredGoodsDraftValues = {
    core: { title: '合成测试商品', description: '这是可供审核的合成商品详情。', priceFen: 9900, coverMediaId: 'media-cover', imageMediaIds: ['media-one'] },
    fields: { rank: 'rank:king', heroes: ['hero:1'] },
  }

  it('lets a draft omit required fields but requires the complete frozen form before submission', () => {
    const form = buildRestoredPublishForm(directory, publicConfig)
    expect(validateRestoredPublishSubmission(form, { core: { ...values.core, coverMediaId: null, imageMediaIds: [] }, fields: {} }, false)).toEqual([])
    expect(validateRestoredPublishSubmission(form, { core: values.core, fields: {} }, true)).toEqual(['请填写段位'])
    expect(validateRestoredPublishSubmission(form, values, true)).toEqual([])
  })

  it('applies every frozen GOODS_FIELD validation rule to the mapped core values', () => {
    const coreFields = [
      { fieldId: 'title', sourceType: 'GOODS_FIELD', sourceKey: 'title', label: '标题', valueType: 'GOODS_FIELD', uiType: 'INPUT', cardinality: 'ONE', required: true, validation: { minLength: 2, maxLength: 5 }, options: [] },
      { fieldId: 'description', sourceType: 'GOODS_FIELD', sourceKey: 'description', label: '描述', valueType: 'GOODS_FIELD', uiType: 'TEXTAREA', cardinality: 'ONE', required: false, validation: { maxLength: 10 }, options: [] },
      { ...directory.fields[2], validation: { min: 100, max: 50_000 } },
      { fieldId: 'images', sourceType: 'GOODS_FIELD', sourceKey: 'images', label: '商品图片', valueType: 'GOODS_FIELD', uiType: 'IMAGE_UPLOAD', cardinality: 'MANY', required: true, validation: { minItems: 1, maxItems: 2 }, options: [] },
    ] as const
    const coreDirectory = { ...directory, fields: coreFields }
    const corePublic = {
      ...publicConfig,
      compiled: { ...publicConfig.compiled, scenes: [{
        ...publicConfig.compiled.scenes[0],
        fields: coreFields.map(field => ({ fieldId: field.fieldId, sourceType: field.sourceType, sourceKey: field.sourceKey, label: field.label, uiType: field.uiType, status: 'ACTIVE' as const })),
        steps: [{ stepId: 'core', name: '核心资料', sortOrder: 10, status: 'ACTIVE' as const, fieldIds: coreFields.map(field => field.fieldId) }],
      }] },
    }
    const form = buildRestoredPublishForm(coreDirectory, corePublic)
    const invalid: RestoredGoodsDraftValues = {
      core: { title: '短', description: '12345678901', priceFen: 99, coverMediaId: null, imageMediaIds: ['one', 'two', 'three'] },
      fields: {},
    }
    expect(validateRestoredPublishSubmission(form, invalid, false)).toEqual([
      '标题数量或长度超出允许范围',
      '描述数量或长度超出允许范围',
      '售价超出允许范围',
      '商品图片数量或长度超出允许范围',
    ])
    expect(validateRestoredPublishSubmission(form, {
      core: { ...invalid.core, title: '有效标题', description: '有效描述', priceFen: 12_300, imageMediaIds: ['one'] }, fields: {},
    }, true)).toEqual([])
  })

  it('submits frozen fullKeys once per source and never submits GOODS_FIELD as an attribute', () => {
    const form = buildRestoredPublishForm(directory, publicConfig)
    expect(collectRestoredGoodsFields(form, values.fields)).toEqual([
      { sourceType: 'ATTRIBUTE', sourceKey: 'rank', valueType: 'ENUM', value: 'rank:king' },
      { sourceType: 'GROUP', sourceKey: 'heroes', valueType: 'GROUP_SET', value: ['hero:1'] },
    ])
  })
})
