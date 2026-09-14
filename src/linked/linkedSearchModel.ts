import type { LinkedSearchClause, LinkedSearchProjection, LinkedSearchRequest } from '../../../双端演示/src/contract'

export type LinkedSearchFieldValue = {
  optionId?: string
  min?: string
  max?: string
  booleanValue?: boolean
  optionIds?: string[]
  matchMode?: 'ALL' | 'ANY'
}

export type LinkedSearchValues = Record<string, LinkedSearchFieldValue>

export type LinkedSearchBaseline = {
  sessionId: string
  gameCode: string
  versionId: string | null
  schemaHash: string | null
  mode: LinkedSearchProjection['mode']
  projection: LinkedSearchProjection
}

export function createLinkedSearchBaseline(sessionId: string, projection: LinkedSearchProjection): LinkedSearchBaseline {
  return {
    sessionId,
    gameCode: projection.gameCode,
    versionId: projection.versionId,
    schemaHash: projection.schemaHash,
    mode: projection.mode,
    projection,
  }
}

export function applyLinkedSearchProjection(sessionId: string, projection: LinkedSearchProjection) {
  return { baseline: createLinkedSearchBaseline(sessionId, projection), values: {} as LinkedSearchValues }
}

export function countLinkedSearchValues(values: LinkedSearchValues) {
  return Object.values(values).filter(hasLinkedSearchValue).length
}

function hasOwnBooleanValue(value: LinkedSearchFieldValue) {
  return Object.prototype.hasOwnProperty.call(value, 'booleanValue') && value.booleanValue !== undefined
}

function hasGroupSelectionInput(value: LinkedSearchFieldValue) {
  if (!Object.prototype.hasOwnProperty.call(value, 'optionIds') || value.optionIds === undefined) return false
  return !Array.isArray(value.optionIds) || value.optionIds.length > 0
}

function hasLinkedSearchValue(value: LinkedSearchFieldValue) {
  return Boolean(value.optionId || value.min?.trim() || value.max?.trim() || hasOwnBooleanValue(value) || hasGroupSelectionInput(value))
}

export function sortLinkedSearchFields(fields: LinkedSearchProjection['fields']) {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((left, right) => {
      if (left.field.isPrimary !== right.field.isPrimary) return left.field.isPrimary ? -1 : 1
      return left.field.sortOrder - right.field.sortOrder || left.index - right.index
    })
    .map(({ field }) => field)
}

export function getLinkedSearchConflict(
  sessionId: string,
  current: LinkedSearchProjection,
  baseline: LinkedSearchBaseline,
  values: LinkedSearchValues,
) {
  if (countLinkedSearchValues(values) === 0) return ''
  if (sessionId !== baseline.sessionId) return '联动会话已重置，当前动态筛选条件仍保留，请应用最新筛选后重新选择。'
  if (current.gameCode !== baseline.gameCode) return '游戏已切换，旧游戏的动态筛选不能用于当前列表。'
  if (current.versionId !== baseline.versionId || current.schemaHash !== baseline.schemaHash || current.mode !== baseline.mode) {
    return '管理端已发布新的筛选配置。当前条件未被自动替换，请显式应用最新筛选。'
  }
  return ''
}

function finiteNumber(value: string | undefined) {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function buildLinkedSearchRequest(projection: LinkedSearchProjection, values: LinkedSearchValues): {
  request: LinkedSearchRequest | null
  issues: string[]
} {
  const issues: string[] = []
  const clauses: LinkedSearchClause[] = []
  const knownFieldIds = new Set(projection.fields.map((field) => field.id))
  for (const [fieldId, value] of Object.entries(values)) {
    if (!knownFieldIds.has(fieldId) && hasLinkedSearchValue(value)) issues.push('存在已失效的筛选字段，请应用最新筛选。')
  }

  for (const field of projection.fields) {
    const value = values[field.id]
    if (!value) continue
    if (field.scene === 'SINGLE') {
      if (!value.optionId) continue
      if (!field.options.some((option) => option.id === value.optionId)) {
        issues.push(`「${field.label}」的选项已不属于当前筛选配置。`)
        continue
      }
      clauses.push({ fieldId: field.id, scene: 'SINGLE', operator: 'IN', optionId: value.optionId })
      continue
    }

    if (field.scene === 'BOOLEAN') {
      if (!hasOwnBooleanValue(value)) continue
      if (typeof value.booleanValue !== 'boolean') {
        issues.push(`「${field.label}」请选择是或否。`)
        continue
      }
      clauses.push({ fieldId: field.id, scene: 'BOOLEAN', operator: 'IN', value: value.booleanValue })
      continue
    }

    if (field.scene === 'GROUP_MULTI') {
      if (!hasGroupSelectionInput(value)) continue
      if (!Array.isArray(value.optionIds) || value.optionIds.some((optionId) => typeof optionId !== 'string' || !optionId)) {
        issues.push(`「${field.label}」的已选项格式无效。`)
        continue
      }
      if (new Set(value.optionIds).size !== value.optionIds.length) {
        issues.push(`「${field.label}」存在重复选项。`)
        continue
      }
      const optionCounts = new Map<string, number>()
      for (const option of field.options) optionCounts.set(option.id, (optionCounts.get(option.id) ?? 0) + 1)
      if (value.optionIds.some((optionId) => optionCounts.get(optionId) !== 1)) {
        issues.push(`「${field.label}」的已选项不属于当前筛选配置。`)
        continue
      }
      const matchMode = value.matchMode ?? field.defaultMatchMode ?? 'ALL'
      if ((matchMode !== 'ALL' && matchMode !== 'ANY') || !field.allowedMatchModes?.includes(matchMode)) {
        issues.push(`「${field.label}」的匹配方式不属于当前筛选配置。`)
        continue
      }
      clauses.push({ fieldId: field.id, scene: 'GROUP_MULTI', operator: 'IN', optionIds: [...value.optionIds], matchMode })
      continue
    }

    const min = finiteNumber(value.min)
    const max = finiteNumber(value.max)
    if (min === undefined || max === undefined) {
      issues.push(`「${field.label}」请输入有限数字。`)
      continue
    }
    if (min === null && max === null) continue
    if (min !== null && max !== null && min > max) {
      issues.push(`「${field.label}」的最低值不能高于最高值。`)
      continue
    }
    clauses.push({ fieldId: field.id, scene: 'RANGE', operator: 'BETWEEN', min, max })
  }

  if (clauses.length === 0) return { request: null, issues: [...new Set(issues)] }
  if (!projection.schemaHash || !['CONFIGURED', 'PARTIAL'].includes(projection.mode)) {
    issues.push('当前游戏没有可用的动态筛选配置。')
    return { request: null, issues: [...new Set(issues)] }
  }
  return { request: { gameCode: projection.gameCode, searchSchemaHash: projection.schemaHash, clauses }, issues: [...new Set(issues)] }
}

export function removeLinkedSearchValue(values: LinkedSearchValues, fieldId: string): LinkedSearchValues {
  const next = { ...values }
  delete next[fieldId]
  return next
}

export function describeLinkedSearchValue(projection: LinkedSearchProjection, fieldId: string, value: LinkedSearchFieldValue) {
  const field = projection.fields.find((item) => item.id === fieldId)
  if (!field) return null
  if (field.scene === 'SINGLE') {
    const option = field.options.find((item) => item.id === value.optionId)
    return option ? { label: field.label, value: option.name } : null
  }
  if (field.scene === 'BOOLEAN') {
    if (!hasOwnBooleanValue(value) || typeof value.booleanValue !== 'boolean') return null
    return { label: field.label, value: value.booleanValue ? '是' : '否' }
  }
  if (field.scene === 'GROUP_MULTI') {
    if (!Array.isArray(value.optionIds) || value.optionIds.length === 0 || new Set(value.optionIds).size !== value.optionIds.length) return null
    const optionNames = value.optionIds.map((optionId) => {
      const matches = field.options.filter((option) => option.id === optionId)
      return matches.length === 1 ? matches[0].name : null
    })
    if (optionNames.some((name) => name === null)) return null
    const matchMode = value.matchMode ?? field.defaultMatchMode ?? 'ALL'
    if ((matchMode !== 'ALL' && matchMode !== 'ANY') || !field.allowedMatchModes?.includes(matchMode)) return null
    return { label: field.label, value: `${matchMode === 'ALL' ? '全部' : '任一'}：${optionNames.join('、')}` }
  }
  const min = value.min?.trim()
  const max = value.max?.trim()
  if (!min && !max) return null
  return { label: field.label, value: min && max ? `${min}–${max}` : min ? `≥${min}` : `≤${max}` }
}
