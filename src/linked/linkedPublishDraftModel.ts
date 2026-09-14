import type { LinkedPublishForm, LinkedPublishFormField } from '../../../双端演示/src/publish-config'

export type LinkedPublishFormValue = string | number | boolean | string[] | undefined
export type LinkedPublishFormValues = Record<string, LinkedPublishFormValue>
export type LinkedPublishDraftSources = {
  attributes: Record<string, unknown>
  groupSelections: Record<string, string[]>
}

function sourceType(field: LinkedPublishFormField) {
  return field.sourceType ?? 'ATTRIBUTE'
}

function sourceKey(field: LinkedPublishFormField) {
  return field.sourceKey ?? field.logicalKey
}

function many(field: LinkedPublishFormField) {
  return field.cardinality === 'MANY' || field.uiType === 'CHECKBOX'
}

function normalizedValue(field: LinkedPublishFormField, value: unknown): LinkedPublishFormValue | null {
  if (value === undefined || value === null || value === '' || Array.isArray(value) && value.length === 0) return undefined
  if (field.valueType === 'NUMBER') return typeof value === 'number' && Number.isFinite(value) ? value : null
  if (field.valueType === 'BOOLEAN') return typeof value === 'boolean' ? value : null
  if (many(field)) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string') || new Set(value).size !== value.length) return null
    const selected = new Set(value)
    if (value.some((id) => !field.options.some((option) => option.id === id))) return null
    return field.options.filter((option) => selected.has(option.id)).map((option) => option.id)
  }
  return typeof value === 'string' && field.options.some((option) => option.id === value) ? value : null
}

export function linkedPublishFormIdentity(form: LinkedPublishForm) {
  return JSON.stringify([form.gameCode, form.mode, form.versionId, form.schemaHash])
}

export function getLinkedPublishFormConflict(current: LinkedPublishForm, pinned: LinkedPublishForm) {
  if (linkedPublishFormIdentity(current) === linkedPublishFormIdentity(pinned)) return ''
  return '发布模板已更新，当前草稿已保留且不会自动套用新模板；请显式应用最新模板后核对'
}

export function hydrateLinkedPublishValuesWithIssues(
  form: LinkedPublishForm,
  attributes: Record<string, unknown>,
  groupSelections: Record<string, string[]> = {},
): { values: LinkedPublishFormValues; issues: string[] } {
  const values: LinkedPublishFormValues = {}
  const issues: string[] = []
  if (form.mode !== 'CONFIGURED') return { values, issues }
  for (const field of form.sections.flatMap((section) => section.fields)) {
    const source = sourceType(field) === 'GROUP' ? groupSelections : attributes
    const key = sourceKey(field)
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue
    const value = normalizedValue(field, source[key])
    if (value === null) {
      issues.push(`「${field.label}」的原值与最新模板不兼容，未自动带入，请重新选择`)
      continue
    }
    if (value !== undefined) values[field.fieldKey] = value
  }
  return { values, issues: [...new Set(issues)] }
}

/** Rehydrate only exact typed canonical values. Labels and display text are never reverse-mapped. */
export function hydrateLinkedPublishValues(
  form: LinkedPublishForm,
  attributes: Record<string, unknown>,
  groupSelections: Record<string, string[]> = {},
): LinkedPublishFormValues {
  return hydrateLinkedPublishValuesWithIssues(form, attributes, groupSelections).values
}

/** Preserve valid values in separate ATTRIBUTE and GROUP namespaces. */
export function projectLinkedPublishDraftSources(form: LinkedPublishForm, values: LinkedPublishFormValues): LinkedPublishDraftSources {
  const result: LinkedPublishDraftSources = { attributes: {}, groupSelections: {} }
  if (form.mode !== 'CONFIGURED') return result
  for (const field of form.sections.flatMap((section) => section.fields)) {
    const value = normalizedValue(field, values[field.fieldKey])
    if (value === null || value === undefined) continue
    const key = sourceKey(field)
    if (sourceType(field) === 'GROUP') {
      if (Array.isArray(value)) result.groupSelections[key] = [...value]
    } else result.attributes[key] = Array.isArray(value) ? [...value] : value
  }
  return result
}

/** Compatibility helper for the original ATTRIBUTE-only callers. */
export function projectLinkedPublishDraftAttributes(form: LinkedPublishForm, values: LinkedPublishFormValues): Record<string, unknown> {
  return projectLinkedPublishDraftSources(form, values).attributes
}

export function rebaseLinkedPublishDraftSources(
  form: LinkedPublishForm,
  values: LinkedPublishFormValues,
  baseline: LinkedPublishDraftSources,
): LinkedPublishDraftSources {
  const attributes = { ...baseline.attributes }
  const groupSelections = Object.fromEntries(Object.entries(baseline.groupSelections).map(([key, selected]) => [key, [...selected]]))
  if (form.mode !== 'CONFIGURED') return { attributes, groupSelections }
  for (const field of form.sections.flatMap((section) => section.fields)) {
    if (sourceType(field) === 'GROUP') delete groupSelections[sourceKey(field)]
    else delete attributes[sourceKey(field)]
  }
  const projected = projectLinkedPublishDraftSources(form, values)
  return { attributes: { ...attributes, ...projected.attributes }, groupSelections: { ...groupSelections, ...projected.groupSelections } }
}

/** Compatibility helper for the original ATTRIBUTE-only callers. */
export function rebaseLinkedPublishDraftAttributes(
  form: LinkedPublishForm,
  values: LinkedPublishFormValues,
  baselineAttributes: Record<string, unknown>,
) {
  return rebaseLinkedPublishDraftSources(form, values, { attributes: baselineAttributes, groupSelections: {} }).attributes
}

export function hasLinkedPublishDraftInput(values: LinkedPublishFormValues, platform: string, rank: string) {
  return Boolean(platform.trim() || rank.trim() || Object.values(values).some((value) =>
    typeof value === 'string' ? Boolean(value.trim())
      : typeof value === 'number' ? Number.isFinite(value)
        : typeof value === 'boolean' ? true
          : Array.isArray(value) && value.length > 0,
  ))
}

export function canChangeLinkedGoodsGame(baselineKind: 'create' | 'edit' | 'invalid') {
  return baselineKind === 'create'
}
