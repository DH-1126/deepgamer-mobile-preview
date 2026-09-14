import { describe, expect, it } from 'vitest'
import { getLinkedPublishForm, validatePublishValues, type LinkedPublishForm } from '../../../双端演示/src/publish-config'
import { createLinkedSeed } from '../../../双端演示/src/seed'
import type { LinkedState } from '../../../双端演示/src/contract'
import { canChangeLinkedGoodsGame, getLinkedPublishFormConflict, hasLinkedPublishDraftInput, hydrateLinkedPublishValues, hydrateLinkedPublishValuesWithIssues, linkedPublishFormIdentity, projectLinkedPublishDraftAttributes, projectLinkedPublishDraftSources, rebaseLinkedPublishDraftAttributes, rebaseLinkedPublishDraftSources } from './linkedPublishDraftModel'

const configured = (versionId = 'publish-v1', schemaHash = 'hash-v1'): LinkedPublishForm => ({
  mode: 'CONFIGURED', gameCode: 'dwrg', versionId, schemaHash, issues: [],
  sections: [{ sectionKey: 'account', title: '账号资料', description: '', sortOrder: 1, fields: [
    { fieldKey: 'os-field', logicalKey: 'operating_system', sourceId: 'os', label: '系统', valueType: 'ENUM', uiType: 'SELECT', required: true, sortOrder: 1, placeholder: '', helpText: '', validation: {}, options: [{ id: 'ios', name: 'iOS' }, { id: 'android', name: '安卓' }] },
    { fieldKey: 'count-field', logicalKey: 'costume_count', sourceId: 'count', label: '时装数', valueType: 'NUMBER', uiType: 'NUMBER', required: true, sortOrder: 2, placeholder: '', helpText: '', validation: {}, options: [] },
  ] }],
})

const extended = (): LinkedPublishForm => ({
  ...configured('publish-rebuild-v1', 'rebuild-hash'),
  reconstruction: { onlineVersionStatus: 'VERSION_UNVERIFIED', validationPolicy: 'FIELD_ONLY' },
  sections: [{ sectionKey: 'assets', title: '时装资产', description: '', sortOrder: 4, requiredObserved: true, requiredSemantics: null, fields: [
    { fieldKey: 'login', logicalKey: 'login_method', sourceId: 'login', label: '登录方式', valueType: 'ENUM', uiType: 'RADIO', cardinality: 'ONE', required: true, sortOrder: 1, placeholder: '', helpText: '', validation: {}, options: [{ id: 'phone', name: '手机号' }, { id: 'email', name: '邮箱' }] },
    { fieldKey: 'change-name', logicalKey: 'can_change_real_name', sourceId: 'change-name', label: '是否可二次实名', valueType: 'BOOLEAN', uiType: 'SWITCH', cardinality: 'ONE', required: false, sortOrder: 2, placeholder: '', helpText: '', validation: {}, options: [] },
    { fieldKey: 'costumes', logicalKey: 'costumes', sourceId: 'costumes', label: '时装', valueType: 'ENUM', uiType: 'CHECKBOX', cardinality: 'MANY', required: false, sortOrder: 3, placeholder: '', helpText: '', validation: {}, options: [{ id: 'costume-a', name: '时装A' }, { id: 'costume-b', name: '时装B' }] },
    { fieldKey: 'rare', logicalKey: 'g:dwrg_rare_costumes', sourceType: 'GROUP', sourceKey: 'g:dwrg_rare_costumes', sourceId: 'rare-group', label: '稀世时装', valueType: 'ENUM', uiType: 'CHECKBOX', cardinality: 'MANY', required: false, sortOrder: 4, placeholder: '', helpText: '', validation: {}, options: [{ id: 'costume-a', name: '稀世A' }, { id: 'costume-b', name: '稀世B' }] },
  ] }],
})

describe('linked publish draft model', () => {
  it('keeps draft compatibility tied to the published version and schema hash', () => {
    const pinned = configured()
    expect(getLinkedPublishFormConflict(configured(), pinned)).toBe('')
    expect(getLinkedPublishFormConflict(configured('publish-v2', 'hash-v2'), pinned)).toContain('草稿已保留')
    expect(linkedPublishFormIdentity({ ...pinned, issues: ['unrelated'] })).toBe(linkedPublishFormIdentity(pinned))
  })

  it('rehydrates exact canonical values without guessing from labels or coercing numbers', () => {
    expect(hydrateLinkedPublishValues(configured(), { operating_system: 'ios', costume_count: 88 }))
      .toEqual({ 'os-field': 'ios', 'count-field': 88 })
    expect(hydrateLinkedPublishValues(configured(), { operating_system: 'iOS', costume_count: '88' })).toEqual({})
  })

  it('carries a pinned draft to a new field key only through the canonical logical key', () => {
    const pinned = configured()
    const latest = configured('publish-v2', 'hash-v2')
    latest.sections[0].fields = latest.sections[0].fields.map((field) => ({ ...field, fieldKey: `v2-${field.fieldKey}` }))
    const canonical = projectLinkedPublishDraftAttributes(pinned, { 'os-field': 'android', 'count-field': 0, extra: 'ignored' })
    expect(canonical).toEqual({ operating_system: 'android', costume_count: 0 })
    expect(hydrateLinkedPublishValues(latest, canonical)).toEqual({ 'v2-os-field': 'android', 'v2-count-field': 0 })
  })

  it('does not resurrect a baseline value explicitly cleared before applying a new template', () => {
    const baseline = { operating_system: 'ios', costume_count: 88, newly_exposed: 12 }
    const rebased = rebaseLinkedPublishDraftAttributes(configured(), { 'os-field': '', 'count-field': 0 }, baseline)
    expect(rebased).toEqual({ costume_count: 0, newly_exposed: 12 })

    const latest = configured('publish-v2', 'hash-v2')
    latest.sections[0].fields.push({ ...latest.sections[0].fields[1], fieldKey: 'new-field', logicalKey: 'newly_exposed', required: false })
    expect(hydrateLinkedPublishValues(latest, rebased)).toEqual({ 'count-field': 0, 'new-field': 12 })
  })

  it('requires game-switch confirmation only when the create draft has meaningful game values', () => {
    expect(canChangeLinkedGoodsGame('create')).toBe(true)
    expect(canChangeLinkedGoodsGame('edit')).toBe(false)
    expect(canChangeLinkedGoodsGame('invalid')).toBe(false)
    expect(hasLinkedPublishDraftInput({}, '', '')).toBe(false)
    expect(hasLinkedPublishDraftInput({ optional: '' }, '   ', '')).toBe(false)
    expect(hasLinkedPublishDraftInput({ count: 0 }, '', '')).toBe(true)
    expect(hasLinkedPublishDraftInput({ switch: false }, '', '')).toBe(true)
    expect(hasLinkedPublishDraftInput({ costumes: ['costume-a'] }, '', '')).toBe(true)
    expect(hasLinkedPublishDraftInput({ costumes: [] }, '', '')).toBe(false)
    expect(hasLinkedPublishDraftInput({}, '', '最强王者')).toBe(true)
  })

  it('does not project configured values into basic or blocked forms', () => {
    const basic: LinkedPublishForm = { mode: 'BASIC', gameCode: 'sjzxd', versionId: null, schemaHash: null, sections: [], issues: [] }
    expect(hydrateLinkedPublishValues(basic, { operating_system: 'ios' })).toEqual({})
  })

  it('submits typed field keys and receives canonical attributes plus frozen display values', () => {
    const result = validatePublishValues(configured(), { 'os-field': 'ios', 'count-field': 88 })
    expect(result.attributes).toEqual({ operating_system: 'ios', costume_count: 88 })
    expect(result.sections[0].fields).toEqual([
      expect.objectContaining({ logicalKey: 'operating_system', value: 'ios', displayValue: 'iOS', provided: true }),
      expect.objectContaining({ logicalKey: 'costume_count', value: 88, displayValue: '88', provided: true }),
    ])
  })

  it('honors the real baseline modes without silently falling back from a broken published template', () => {
    const seed = createLinkedSeed()
    const state: LinkedState = {
      ...seed,
      titleConfigs: seed.titleConfigs ?? [],
      publishConfigs: seed.publishConfigs ?? [],
      detailConfigs: seed.detailConfigs ?? [],
      searchConfigs: seed.searchConfigs ?? [],
      sessionId: 'publish-mode-regression',
      revision: 1,
      media: {},
      seller: {
        id: 'linked_seller_001', displayName: '联动演示卖家', status: 'NONE', contractStatus: 'UNSIGNED',
        rowVersion: 1, application: null, applicationId: null, reviewReason: '', submittedAt: null, reviewedAt: null,
      },
    }
    expect(getLinkedPublishForm(state, 'dwrg').mode).toBe('CONFIGURED')
    expect(getLinkedPublishForm(state, 'wzry')).toMatchObject({ mode: 'BLOCKED' })
    expect(getLinkedPublishForm(state, 'wzry').issues.join('；')).toContain('缺少已启用选项')
    expect(getLinkedPublishForm(state, 'sjzxd')).toMatchObject({ mode: 'BASIC', versionId: null })
  })

  it('hydrates and projects radio, multi-select, false and GROUP values without crossing namespaces', () => {
    const form = extended()
    const values = hydrateLinkedPublishValues(form, {
      login_method: 'phone', can_change_real_name: false, costumes: ['costume-b', 'costume-a'],
    }, { 'g:dwrg_rare_costumes': ['costume-b'] })
    expect(values).toEqual({ login: 'phone', 'change-name': false, costumes: ['costume-a', 'costume-b'], rare: ['costume-b'] })
    expect(projectLinkedPublishDraftSources(form, values)).toEqual({
      attributes: { login_method: 'phone', can_change_real_name: false, costumes: ['costume-a', 'costume-b'] },
      groupSelections: { 'g:dwrg_rare_costumes': ['costume-b'] },
    })
  })

  it('warns and drops an incompatible old multi-value as a whole instead of silently truncating it', () => {
    const hydrated = hydrateLinkedPublishValuesWithIssues(extended(), { costumes: ['costume-a', 'removed'] }, {})
    expect(hydrated.values).not.toHaveProperty('costumes')
    expect(hydrated.issues).toEqual([expect.stringContaining('未自动带入')])
  })

  it('keeps explicit clears cleared while rebasing ATTRIBUTE and GROUP namespaces', () => {
    const rebased = rebaseLinkedPublishDraftSources(extended(), { login: 'email', costumes: [], rare: [] }, {
      attributes: { login_method: 'phone', costumes: ['costume-a'], unrelated: 1 },
      groupSelections: { 'g:dwrg_rare_costumes': ['costume-a'], unrelated_group: ['x'] },
    })
    expect(rebased).toEqual({
      attributes: { login_method: 'email', unrelated: 1 },
      groupSelections: { unrelated_group: ['x'] },
    })
  })
})
