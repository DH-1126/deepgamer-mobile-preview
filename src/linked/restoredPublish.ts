export type RestoredPublishValueType = 'ENUM' | 'NUMBER' | 'TEXT' | 'BOOLEAN' | 'DATETIME' | 'GROUP_SET' | 'GOODS_FIELD'
export type RestoredPublishSourceType = 'ATTRIBUTE' | 'GROUP' | 'GOODS_FIELD'
export type RestoredPublishFieldValue = string | number | boolean | string[] | undefined

export interface RestoredPublishDirectoryField {
  fieldId: string
  sourceType: RestoredPublishSourceType
  sourceKey: string
  label: string
  valueType: RestoredPublishValueType
  uiType: string
  cardinality: 'ONE' | 'MANY'
  required: boolean
  placeholder?: string
  helpText?: string
  validation: { min?: number; max?: number; minLength?: number; maxLength?: number; minItems?: number; maxItems?: number }
  options: ReadonlyArray<{ key: string; label: string }>
}

export interface RestoredPublishDirectory {
  gameId: string
  gameCode: string
  gameName: string
  publishRevisionId: string
  publishSnapshotId: string
  configVersionId: string
  schemaHash: string
  fields: RestoredPublishDirectoryField[]
}

export interface RestoredPublicPublishConfig {
  gameCode: string
  scope: 'PUBLISH'
  revisionId: string
  snapshotId: string
  configVersionId: string
  schemaHash: string
  compiled: unknown
}

export interface RestoredPublishStep {
  stepId: string
  name: string
  description?: string
  fields: RestoredPublishDirectoryField[]
}

export interface RestoredPublishForm {
  gameCode: string
  gameName: string
  publishRevisionId: string
  publishSnapshotId: string
  configVersionId: string
  schemaHash: string
  steps: RestoredPublishStep[]
  fields: Record<string, RestoredPublishDirectoryField>
}

export interface RestoredGoodsDraftValues {
  core: {
    title: string
    description: string
    priceFen: number
    coverMediaId: string | null
    imageMediaIds: string[]
  }
  fields: Record<string, RestoredPublishFieldValue>
}

type UnknownRecord = Record<string, unknown>
const validationKeys = new Set(['min', 'max', 'minLength', 'maxLength', 'minItems', 'maxItems'])
const supportedValueTypes = new Set<RestoredPublishValueType>(['ENUM', 'NUMBER', 'TEXT', 'BOOLEAN', 'DATETIME', 'GROUP_SET', 'GOODS_FIELD'])
const supportedUiTypes = new Set(['INPUT', 'TEXTAREA', 'NUMBER', 'RADIO', 'CHECKBOX', 'SELECT', 'MULTI_SELECT', 'SWITCH', 'IMAGE_UPLOAD'])

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}缺失或格式错误`)
  return value
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}格式错误`)
  return value
}

function statusActive(value: unknown): boolean {
  return value !== 'DISABLED' && value !== false && value !== 0
}

function parseDirectoryField(value: unknown): RestoredPublishDirectoryField {
  const row = record(value)
  if (!row) throw new Error('商品发布字段格式错误')
  const sourceType = text(row.sourceType, '字段来源') as RestoredPublishSourceType
  if (!['ATTRIBUTE', 'GROUP', 'GOODS_FIELD'].includes(sourceType)) throw new Error('商品发布字段来源不受支持')
  const valueType = text(row.valueType, '字段值类型') as RestoredPublishValueType
  if (!supportedValueTypes.has(valueType)) throw new Error('商品发布字段值类型不受支持')
  const uiType = text(row.uiType, '字段控件')
  if (!supportedUiTypes.has(uiType)) throw new Error(`商品发布字段控件 ${uiType} 不受支持`)
  const goodsUi: Record<string, string[]> = {
    title: ['INPUT'], goods_title: ['INPUT'], description: ['TEXTAREA', 'INPUT'], goods_description: ['TEXTAREA', 'INPUT'],
    price: ['NUMBER', 'INPUT'], price_fen: ['NUMBER', 'INPUT'], cover: ['IMAGE_UPLOAD'], cover_image: ['IMAGE_UPLOAD'],
    cover_image_url: ['IMAGE_UPLOAD'], images: ['IMAGE_UPLOAD'], image_urls: ['IMAGE_UPLOAD'], goods_images: ['IMAGE_UPLOAD'],
  }
  const typedUi: Record<Exclude<RestoredPublishValueType, 'GOODS_FIELD'>, string[]> = {
    ENUM: ['RADIO', 'CHECKBOX', 'SELECT', 'MULTI_SELECT'], NUMBER: ['NUMBER', 'INPUT'], TEXT: ['INPUT', 'TEXTAREA'],
    BOOLEAN: ['SWITCH'], DATETIME: ['INPUT'], GROUP_SET: ['CHECKBOX', 'MULTI_SELECT'],
  }
  if (sourceType === 'GOODS_FIELD') {
    const allowed = goodsUi[String(row.sourceKey).toLowerCase()]
    if (!allowed || !allowed.includes(uiType)) throw new Error(`商品核心字段 ${String(row.sourceKey)} 的控件不受支持`)
  } else if (valueType === 'GOODS_FIELD' || !typedUi[valueType]?.includes(uiType)) {
    throw new Error(`商品发布字段 ${String(row.sourceKey)} 的值类型与控件不兼容`)
  }
  const cardinality = text(row.cardinality, '字段基数')
  if (cardinality !== 'ONE' && cardinality !== 'MANY') throw new Error('商品发布字段基数不受支持')
  const rules = record(row.validation)
  if (!rules || Object.keys(rules).some(key => !validationKeys.has(key))) throw new Error('商品发布配置含不支持的校验规则')
  const validation = Object.fromEntries(Object.entries(rules).map(([key, item]) => [key, finite(item, `校验规则 ${key}`)])) as RestoredPublishDirectoryField['validation']
  if (!Array.isArray(row.options)) throw new Error('商品发布字段选项格式错误')
  const options = row.options.map(item => {
    const option = record(item)
    if (!option) throw new Error('商品发布字段选项格式错误')
    return { key: text(option.key, '选项 fullKey'), label: text(option.label, '选项名称') }
  })
  const optionKeys = options.map(item => item.key)
  if (new Set(optionKeys).size !== optionKeys.length) throw new Error('商品发布字段含重复选项')
  return {
    fieldId: text(row.fieldId, '字段 ID'), sourceType, sourceKey: text(row.sourceKey, '字段机器键'),
    label: text(row.label, '字段名称'), valueType, uiType, cardinality, required: row.required === true,
    ...(typeof row.placeholder === 'string' ? { placeholder: row.placeholder } : {}),
    ...(typeof row.helpText === 'string' ? { helpText: row.helpText } : {}), validation, options,
  }
}

export function parseRestoredPublishDirectory(value: unknown): RestoredPublishDirectory {
  const row = record(value)
  if (!row || !Array.isArray(row.fields)) throw new Error('商品发布目录不符合契约')
  const result: RestoredPublishDirectory = {
    gameId: text(row.gameId, '游戏 ID'), gameCode: text(row.gameCode, '游戏标识'), gameName: text(row.gameName, '游戏名称'),
    publishRevisionId: text(row.publishRevisionId, '发布修订标识'), publishSnapshotId: text(row.publishSnapshotId, '发布快照标识'),
    configVersionId: text(row.configVersionId, '基础配置版本'), schemaHash: text(row.schemaHash, '配置摘要'), fields: row.fields.map(parseDirectoryField),
  }
  if (result.fields.length === 0) throw new Error('商品发布目录没有可用字段')
  return result
}

export function parseRestoredPublicPublishConfig(value: unknown): RestoredPublicPublishConfig {
  const row = record(value)
  if (!row) throw new Error('完整 PUBLISH 配置不符合契约')
  if (typeof row.revisionId !== 'string' || !row.revisionId || typeof row.snapshotId !== 'string' || !row.snapshotId) {
    throw new Error('完整 PUBLISH 配置缺少发布修订标识或快照标识，请更新本地恢复产物')
  }
  if (row.scope !== 'PUBLISH') throw new Error('读取的不是 PUBLISH 配置')
  return {
    gameCode: text(row.gameCode, '游戏标识'), scope: 'PUBLISH', revisionId: row.revisionId, snapshotId: row.snapshotId,
    configVersionId: text(row.configVersionId, '基础配置版本'), schemaHash: text(row.schemaHash, '配置摘要'), compiled: row.compiled,
  }
}

type LayoutField = { fieldId: string; sourceType: RestoredPublishSourceType; sourceKey?: string; sourceId?: string; label: string; uiType: string }
type LayoutStep = { stepId: string; name: string; description?: string; fieldIds: string[]; sortOrder: number }

function layoutField(value: unknown, legacy = false): LayoutField {
  const row = record(value)
  if (!row) throw new Error('完整 PUBLISH 字段格式错误')
  const sourceType = text(row.sourceType, '字段来源') as RestoredPublishSourceType
  if (!['ATTRIBUTE', 'GROUP', 'GOODS_FIELD'].includes(sourceType)) throw new Error('完整 PUBLISH 含不支持的字段来源')
  const uiType = text(row.uiType, '字段控件')
  if (!supportedUiTypes.has(uiType)) throw new Error(`完整 PUBLISH 含不支持的控件 ${uiType}`)
  if (!legacy) return { fieldId: text(row.fieldId ?? row.id ?? row.fieldKey, '字段 ID'), sourceType, sourceKey: text(row.sourceKey, '字段机器键'), label: text(row.label, '字段名称'), uiType }
  if (typeof row.sourceKey === 'string') return { fieldId: text(row.fieldId ?? row.id ?? row.fieldKey, '字段 ID'), sourceType, sourceKey: text(row.sourceKey, '字段机器键'), label: text(row.label, '字段名称'), uiType }
  if (row.sourceKey !== undefined || !['ATTRIBUTE', 'GROUP'].includes(sourceType)) throw new Error('旧版 PUBLISH 字段缺少可核验的来源机器键')
  return {
    fieldId: text(row.fieldId ?? row.id ?? row.fieldKey, '字段 ID'), sourceType, sourceId: text(row.sourceId, '旧版字段来源 ID'),
    label: text(row.label, '字段名称'), uiType,
  }
}

function v2Layout(compiled: UnknownRecord): { fields: LayoutField[]; steps: LayoutStep[] } | null {
  if (!Array.isArray(compiled.scenes)) return null
  if (compiled.definitionVersion !== 'publish-v2') throw new Error('完整 PUBLISH 配置版本不受支持')
  const scenes = compiled.scenes.filter(value => record(value)?.fieldSceneType === 'goods_publish')
  if (scenes.length !== 1) throw new Error('完整 PUBLISH 必须且只能包含一个商品发布场景')
  const scene = record(scenes[0])!
  if (!Array.isArray(scene.fields) || !Array.isArray(scene.steps)) throw new Error('完整 PUBLISH 场景格式错误')
  const fields = scene.fields.filter(value => statusActive(record(value)?.status)).map(value => layoutField(value))
  const steps = scene.steps.filter(value => statusActive(record(value)?.status)).map((value, index) => {
    const row = record(value)!
    if (!Array.isArray(row.fieldIds)) throw new Error('完整 PUBLISH 步骤字段格式错误')
    return { stepId: text(row.stepId, '步骤 ID'), name: text(row.name, '步骤名称'), ...(typeof row.description === 'string' && row.description ? { description: row.description } : {}), fieldIds: row.fieldIds.map((id, fieldIndex) => text(id, `步骤字段 ${fieldIndex + 1}`)), sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index }
  })
  return { fields, steps }
}

function legacyLayout(compiled: UnknownRecord): { fields: LayoutField[]; steps: LayoutStep[] } | null {
  const template = record(compiled.template)
  if (!template) return null
  if (template.templateType !== 'PUBLISH' || !statusActive(template.status) || !Array.isArray(template.sections)) throw new Error('旧版 PUBLISH 模板不可用')
  const fields: LayoutField[] = []
  const steps = template.sections.filter(value => statusActive(record(value)?.status)).map((value, index) => {
    const row = record(value)!
    if (row.displayType !== 'FORM_STEP' || !Array.isArray(row.fields)) throw new Error('旧版 PUBLISH 含客户端无法填写的区块')
    const stepFields = row.fields.filter(item => statusActive(record(item)?.status)).map(item => layoutField(item, true))
    fields.push(...stepFields)
    return { stepId: text(row.id ?? row.sectionKey, '旧版步骤 ID'), name: text(row.title, '旧版步骤名称'), ...(typeof row.description === 'string' && row.description ? { description: row.description } : {}), fieldIds: stepFields.map(field => field.fieldId), sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index }
  })
  return { fields, steps }
}

function sameLayoutField(left: LayoutField, right: LayoutField): boolean {
  return left.fieldId === right.fieldId && left.sourceType === right.sourceType && left.sourceKey === right.sourceKey && left.label === right.label && left.uiType === right.uiType
}

export function buildRestoredPublishForm(directoryValue: unknown, publicValue: unknown): RestoredPublishForm {
  const directory = parseRestoredPublishDirectory(directoryValue)
  const published = parseRestoredPublicPublishConfig(publicValue)
  if (published.gameCode !== directory.gameCode || published.revisionId !== directory.publishRevisionId || published.snapshotId !== directory.publishSnapshotId
    || published.configVersionId !== directory.configVersionId || published.schemaHash !== directory.schemaHash) {
    throw new Error('PUBLISH 配置已变更，请重新加载后填写')
  }
  const compiled = record(published.compiled)
  if (!compiled) throw new Error('完整 PUBLISH 配置结构无效')
  const layout = v2Layout(compiled) ?? legacyLayout(compiled)
  if (!layout || layout.steps.length === 0) throw new Error('完整 PUBLISH 配置没有可填写步骤')
  const layoutById = new Map<string, LayoutField>()
  for (const field of layout.fields) {
    const current = layoutById.get(field.fieldId)
    if (current && !sameLayoutField(current, field)) throw new Error(`PUBLISH 字段 ${field.fieldId} 定义冲突`)
    layoutById.set(field.fieldId, field)
  }
  const sourceOwners = new Map<string, string>()
  const directoryById = new Map<string, RestoredPublishDirectoryField>()
  for (const field of directory.fields) {
    if (directoryById.has(field.fieldId)) throw new Error(`PUBLISH 目录字段 ${field.fieldId} 重复`)
    const source = `${field.sourceType}:${field.sourceKey}`
    const existing = sourceOwners.get(source)
    if (existing && existing !== field.fieldId) throw new Error(`PUBLISH 配置中同一来源 ${source} 被不同字段重复引用`)
    sourceOwners.set(source, field.fieldId)
    directoryById.set(field.fieldId, field)
  }
  const mounted = new Set<string>()
  const steps = [...layout.steps].sort((a, b) => a.sortOrder - b.sortOrder).map(step => ({
    stepId: step.stepId, name: step.name, ...(step.description ? { description: step.description } : {}),
    fields: step.fieldIds.map(fieldId => {
      const layoutFieldDefinition = layoutById.get(fieldId)
      if (!layoutFieldDefinition) throw new Error(`PUBLISH 步骤引用了不存在的字段 ${fieldId}`)
      const field = directoryById.get(fieldId)
      if (!field) throw new Error(`PUBLISH 目录缺少步骤字段 ${fieldId}`)
      if (layoutFieldDefinition.sourceType !== field.sourceType || layoutFieldDefinition.sourceKey !== undefined && layoutFieldDefinition.sourceKey !== field.sourceKey
        || layoutFieldDefinition.label !== field.label || layoutFieldDefinition.uiType !== field.uiType) {
        throw new Error(`PUBLISH 目录与完整布局字段 ${fieldId} 不一致`)
      }
      mounted.add(fieldId)
      return field
    }),
  }))
  if (directory.fields.some(field => !mounted.has(field.fieldId))) throw new Error('PUBLISH 目录与完整步骤布局不一致')
  return {
    gameCode: directory.gameCode, gameName: directory.gameName, publishRevisionId: directory.publishRevisionId,
    publishSnapshotId: directory.publishSnapshotId, configVersionId: directory.configVersionId, schemaHash: directory.schemaHash,
    steps, fields: Object.fromEntries([...directoryById]),
  }
}

function provided(value: RestoredPublishFieldValue): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'boolean'
}

function coreProvided(field: RestoredPublishDirectoryField, core: RestoredGoodsDraftValues['core']): boolean {
  const key = field.sourceKey.toLowerCase()
  if (key === 'price' || key === 'price_fen') return core.priceFen > 0
  if (key === 'title' || key === 'goods_title') return core.title.trim().length > 0
  if (key === 'description' || key === 'goods_description') return core.description.trim().length > 0
  if (['cover', 'cover_image', 'cover_image_url'].includes(key)) return Boolean(core.coverMediaId)
  if (['images', 'image_urls', 'goods_images'].includes(key)) return core.imageMediaIds.length > 0
  return false
}

function coreValue(field: RestoredPublishDirectoryField, core: RestoredGoodsDraftValues['core']): RestoredPublishFieldValue {
  const key = field.sourceKey.toLowerCase()
  if (key === 'price' || key === 'price_fen') return core.priceFen
  if (key === 'title' || key === 'goods_title') return core.title
  if (key === 'description' || key === 'goods_description') return core.description
  if (['cover', 'cover_image', 'cover_image_url'].includes(key)) return core.coverMediaId ?? undefined
  if (['images', 'image_urls', 'goods_images'].includes(key)) return core.imageMediaIds
  return undefined
}

function valueIssue(field: RestoredPublishDirectoryField, value: RestoredPublishFieldValue): string | null {
  if (!provided(value)) return null
  const values = Array.isArray(value) ? value : [value]
  if (field.cardinality === 'MANY' && !Array.isArray(value)) return `${field.label}必须多选`
  if (field.cardinality === 'ONE' && Array.isArray(value) && value.length !== 1) return `${field.label}只能选择一项`
  if (field.valueType === 'ENUM' || field.valueType === 'GROUP_SET') {
    if (values.some(item => typeof item !== 'string') || values.some(item => !field.options.some(option => option.key === item))) return `${field.label}包含配置之外的选项`
  } else if (field.valueType === 'NUMBER' && (typeof value !== 'number' || !Number.isFinite(value))) return `${field.label}必须是数值`
  else if ((field.valueType === 'TEXT' || field.valueType === 'DATETIME') && typeof value !== 'string') return `${field.label}格式错误`
  else if (field.valueType === 'BOOLEAN' && typeof value !== 'boolean') return `${field.label}必须选择是或否`
  const size = typeof value === 'string' || Array.isArray(value) ? value.length : null
  if (typeof value === 'number' && (field.validation.min !== undefined && value < field.validation.min || field.validation.max !== undefined && value > field.validation.max)) return `${field.label}超出允许范围`
  if (size !== null && (field.validation.minLength !== undefined && typeof value === 'string' && size < field.validation.minLength
    || field.validation.maxLength !== undefined && typeof value === 'string' && size > field.validation.maxLength
    || field.validation.minItems !== undefined && Array.isArray(value) && size < field.validation.minItems
    || field.validation.maxItems !== undefined && Array.isArray(value) && size > field.validation.maxItems)) return `${field.label}数量或长度超出允许范围`
  return null
}

export function validateRestoredPublishSubmission(form: RestoredPublishForm, values: RestoredGoodsDraftValues, requireComplete: boolean): string[] {
  const issues: string[] = []
  for (const field of Object.values(form.fields)) {
    if (field.sourceType === 'GOODS_FIELD') {
      if (requireComplete && field.required && !coreProvided(field, values.core)) issues.push(`请填写${field.label}`)
      else {
        const value = coreValue(field, values.core)
        const key = field.sourceKey.toLowerCase()
        if ((key === 'price' || key === 'price_fen') && typeof value === 'number' && !Number.isSafeInteger(value)) issues.push(`${field.label}必须使用整数分`)
        else {
          const issue = valueIssue(field, value)
          if (issue) issues.push(issue)
        }
      }
      continue
    }
    const value = values.fields[field.fieldId]
    if (requireComplete && field.required && !provided(value)) issues.push(`请填写${field.label}`)
    else {
      const issue = valueIssue(field, value)
      if (issue) issues.push(issue)
    }
  }
  return issues
}

export function collectRestoredGoodsFields(form: RestoredPublishForm, values: Record<string, RestoredPublishFieldValue>) {
  return Object.values(form.fields).flatMap(field => {
    if (field.sourceType === 'GOODS_FIELD') return []
    const value = values[field.fieldId]
    if (!provided(value)) return []
    return [{ sourceType: field.sourceType, sourceKey: field.sourceKey, valueType: field.valueType as Exclude<RestoredPublishValueType, 'GOODS_FIELD'>, value }]
  })
}
