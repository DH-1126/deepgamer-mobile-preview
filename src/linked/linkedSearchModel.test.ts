import { describe, expect, it } from 'vitest'
import type { LinkedSearchProjection } from '../../../双端演示/src/contract'
import { applyLinkedSearchProjection, buildLinkedSearchRequest, countLinkedSearchValues, createLinkedSearchBaseline, describeLinkedSearchValue, getLinkedSearchConflict, removeLinkedSearchValue, sortLinkedSearchFields } from './linkedSearchModel'

const projection = (overrides: Partial<LinkedSearchProjection> = {}): LinkedSearchProjection => ({
  mode: 'CONFIGURED', gameCode: 'dwrg', gameId: 'game-dwrg', versionId: 'search-v1', versionNo: 1,
  baseConfigVersionId: 'base-v1', schemaHash: 'hash-v1', evidenceHash: 'evidence-v1',
  coverage: { sourceActiveCount: 4, includedCount: 4, excludedCount: 0 }, excludedFields: [], issues: [],
  fields: [
    { id: 'field-os', fieldKey: 'os', label: '操作系统', sourceId: 'attr-os', logicalKey: 'operating_system', valueType: 'ENUM', scene: 'SINGLE', operator: 'IN', isPrimary: true, sortOrder: 1, options: [{ id: 'ios', fullKey: 'ios', name: 'iOS', sortOrder: 1 }] },
    { id: 'field-count', fieldKey: 'count', label: '时装数量', sourceId: 'attr-count', logicalKey: 'costume_count', valueType: 'NUMBER', scene: 'RANGE', operator: 'BETWEEN', isPrimary: false, sortOrder: 2, options: [] },
    { id: 'field-rebind', fieldKey: 'rebind', label: '是否可二次实名', sourceId: 'attr-rebind', logicalKey: 'can_change_real_name', valueType: 'BOOLEAN', scene: 'BOOLEAN', operator: 'IN', isPrimary: true, sortOrder: 3, options: [] },
    {
      id: 'field-costumes', fieldKey: 'costumes', label: '稀世时装', sourceId: 'group-costumes', logicalKey: 'g:dwrg_rare_costumes',
      sourceType: 'GROUP', sourceKey: 'g:dwrg_rare_costumes', valueType: 'ENUM', scene: 'GROUP_MULTI', operator: 'IN',
      allowedMatchModes: ['ALL', 'ANY'], defaultMatchMode: 'ALL', matchRuleEvidenceId: 'online-match-rule-20260914',
      isPrimary: true, sortOrder: 4,
      options: [
        { id: 'costume-a', fullKey: 'group:costume-a', name: '白泽', sortOrder: 1 },
        { id: 'costume-b', fullKey: 'group:costume-b', name: '菲尼克斯', sortOrder: 2 },
      ],
    },
  ],
  ...overrides,
})

describe('linked search draft model', () => {
  it('builds exact enum and inclusive range clauses, preserving zero', () => {
    const result = buildLinkedSearchRequest(projection(), {
      'field-os': { optionId: 'ios' },
      'field-count': { min: '0', max: '15' },
    })
    expect(result.issues).toEqual([])
    expect(result.request?.clauses).toEqual([
      { fieldId: 'field-os', scene: 'SINGLE', operator: 'IN', optionId: 'ios' },
      { fieldId: 'field-count', scene: 'RANGE', operator: 'BETWEEN', min: 0, max: 15 },
    ])
    expect(countLinkedSearchValues({ 'field-count': { min: '0' } })).toBe(1)
  })

  it('does not create a dynamic request for empty values or invalid ranges', () => {
    expect(buildLinkedSearchRequest(projection(), {}).request).toBeNull()
    const invalid = buildLinkedSearchRequest(projection(), { 'field-count': { min: '20', max: '10' } })
    expect(invalid.request).toBeNull()
    expect(invalid.issues[0]).toContain('最低值')
    const stale = buildLinkedSearchRequest(projection(), { 'removed-field': { optionId: 'old-option' } })
    expect(stale.request).toBeNull()
    expect(stale.issues[0]).toContain('已失效')
  })

  it('preserves false as a selected boolean and builds an exact boolean clause', () => {
    const values = { 'field-rebind': { booleanValue: false } }
    const result = buildLinkedSearchRequest(projection(), values)
    expect(result.issues).toEqual([])
    expect(result.request?.clauses).toEqual([
      { fieldId: 'field-rebind', scene: 'BOOLEAN', operator: 'IN', value: false },
    ])
    expect(countLinkedSearchValues(values)).toBe(1)
    expect(describeLinkedSearchValue(projection(), 'field-rebind', values['field-rebind'])).toEqual({ label: '是否可二次实名', value: '否' })
    expect(removeLinkedSearchValue(values, 'field-rebind')).toEqual({})
  })

  it('rejects a non-boolean runtime draft instead of coercing string false', () => {
    const invalidValues = { 'field-rebind': { booleanValue: 'false' } } as unknown as Parameters<typeof buildLinkedSearchRequest>[1]
    const result = buildLinkedSearchRequest(projection(), invalidValues)
    expect(result.request).toBeNull()
    expect(result.issues).toContain('「是否可二次实名」请选择是或否。')
  })

  it('builds explicit ALL and ANY group clauses without treating mode-only state as a condition', () => {
    const defaultAll = buildLinkedSearchRequest(projection(), {
      'field-costumes': { optionIds: ['costume-a', 'costume-b'] },
    })
    expect(defaultAll.issues).toEqual([])
    expect(defaultAll.request?.clauses).toEqual([{
      fieldId: 'field-costumes', scene: 'GROUP_MULTI', operator: 'IN', optionIds: ['costume-a', 'costume-b'], matchMode: 'ALL',
    }])

    const any = buildLinkedSearchRequest(projection(), {
      'field-costumes': { optionIds: ['costume-b'], matchMode: 'ANY' },
    })
    expect(any.issues).toEqual([])
    expect(any.request?.clauses).toEqual([{
      fieldId: 'field-costumes', scene: 'GROUP_MULTI', operator: 'IN', optionIds: ['costume-b'], matchMode: 'ANY',
    }])
    expect(buildLinkedSearchRequest(projection(), { 'field-costumes': { optionIds: [], matchMode: 'ANY' } }).request).toBeNull()
    expect(countLinkedSearchValues({ 'field-costumes': { optionIds: [], matchMode: 'ANY' } })).toBe(0)
  })

  it('rejects duplicate, unknown, malformed, and disallowed group selections without dropping them', () => {
    const duplicate = buildLinkedSearchRequest(projection(), { 'field-costumes': { optionIds: ['costume-a', 'costume-a'], matchMode: 'ALL' } })
    expect(duplicate.request).toBeNull()
    expect(duplicate.issues[0]).toContain('重复选项')

    const unknown = buildLinkedSearchRequest(projection(), { 'field-costumes': { optionIds: ['retired-costume'], matchMode: 'ALL' } })
    expect(unknown.request).toBeNull()
    expect(unknown.issues[0]).toContain('不属于当前筛选配置')

    const malformed = buildLinkedSearchRequest(projection(), { 'field-costumes': { optionIds: 'costume-a' } } as unknown as Parameters<typeof buildLinkedSearchRequest>[1])
    expect(malformed.request).toBeNull()
    expect(malformed.issues[0]).toContain('格式无效')

    const disallowedProjection = projection({ fields: projection().fields.map((field) => field.id === 'field-costumes' ? { ...field, allowedMatchModes: ['ALL'] } : field) })
    const disallowed = buildLinkedSearchRequest(disallowedProjection, { 'field-costumes': { optionIds: ['costume-a'], matchMode: 'ANY' } })
    expect(disallowed.request).toBeNull()
    expect(disallowed.issues[0]).toContain('匹配方式')
  })

  it('describes and removes group selections with the explicit match mode', () => {
    const value = { optionIds: ['costume-b', 'costume-a'], matchMode: 'ANY' as const }
    expect(describeLinkedSearchValue(projection(), 'field-costumes', value)).toEqual({ label: '稀世时装', value: '任一：菲尼克斯、白泽' })
    expect(removeLinkedSearchValue({ 'field-costumes': value }, 'field-costumes')).toEqual({})
  })

  it('keeps selected values on published-version or session conflict until explicit reset', () => {
    const baseline = createLinkedSearchBaseline('session-1', projection())
    const values = { 'field-os': { optionId: 'ios' } }
    expect(getLinkedSearchConflict('session-1', projection({ versionId: 'search-v2', schemaHash: 'hash-v2' }), baseline, values)).toContain('未被自动替换')
    expect(values).toEqual({ 'field-os': { optionId: 'ios' } })
    expect(getLinkedSearchConflict('session-2', projection(), baseline, values)).toContain('会话已重置')
    expect(getLinkedSearchConflict('session-1', projection({ versionId: 'search-v2' }), baseline, {})).toBe('')
  })

  it('keeps a false boolean draft selected across a published-version conflict', () => {
    const baseline = createLinkedSearchBaseline('session-1', projection())
    const values = { 'field-rebind': { booleanValue: false } }
    expect(getLinkedSearchConflict('session-1', projection({ versionId: 'search-v2', schemaHash: 'hash-v2' }), baseline, values)).toContain('未被自动替换')
    expect(values['field-rebind'].booleanValue).toBe(false)
  })

  it('keeps selected group ids and ANY mode across a published-version conflict', () => {
    const baseline = createLinkedSearchBaseline('session-1', projection())
    const values = { 'field-costumes': { optionIds: ['costume-b'], matchMode: 'ANY' as const } }
    expect(getLinkedSearchConflict('session-1', projection({ versionId: 'search-v2', schemaHash: 'hash-v2' }), baseline, values)).toContain('未被自动替换')
    expect(values['field-costumes']).toEqual({ optionIds: ['costume-b'], matchMode: 'ANY' })
  })

  it('clears only dynamic values when explicitly binding another game projection', () => {
    const next = applyLinkedSearchProjection('session-1', projection({ gameCode: 'sjzxd', versionId: null, schemaHash: null, mode: 'MISSING' }))
    expect(next.values).toEqual({})
    expect(next.baseline.gameCode).toBe('sjzxd')
    expect(next.baseline.versionId).toBeNull()
  })

  it('orders primary fields first and keeps sort order stable within each group', () => {
    const fields = projection().fields
    const ordered = sortLinkedSearchFields([
      { ...fields[1], id: 'normal-late', sortOrder: 9 },
      { ...fields[0], id: 'primary-tie-a', sortOrder: 2 },
      { ...fields[1], id: 'normal-early', sortOrder: 1 },
      { ...fields[0], id: 'primary-tie-b', sortOrder: 2 },
    ])
    expect(ordered.map((field) => field.id)).toEqual(['primary-tie-a', 'primary-tie-b', 'normal-early', 'normal-late'])
  })
})
