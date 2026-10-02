import { RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'
import { parseRestoredRecycleMedia, uploadRestoredRecycleMedia, type RestoredRecycleMedia } from './restoredRecycleMedia'

export type RecycleValue = string | number | string[]
export type RecycleField = { fieldKey: string; label: string; valueType: 'text' | 'number' | 'single' | 'multiple'; required: boolean; options: { label: string; value: string }[] }
export type RecycleCatalogItem = { gameCode: string; gameName: string; available: boolean; blockedReason: string | null; eligibleRecyclerCount: number }
export type RecycleGameDetail = { gameCode: string; gameName: string; fieldTemplateVersion: number; fieldSchemaHash: string; fields: RecycleField[]; available: boolean; blockedReason: string | null; attachmentsAvailable: boolean; recyclers: { recyclerId: string; displayName: string; eligible: boolean; blockedReason: string | null }[] }
export type RecycleConsultation = { id: string; clientSubmissionId: string; gameCode: string; profileVersion: 1; profileFields: { fieldKey: string; label: string; value: RecycleValue; displayValue: string }[]; fieldTemplateVersion: number; fieldSchemaHash: string; recyclerId: string; conversationId: string; status: 'SENT'; attachments: RestoredRecycleMedia[]; createdAt: string }
export type RecycleCreate = { clientSubmissionId: string; gameCode: string; fieldTemplateVersion: number; fieldSchemaHash: string; selectedRecyclerIds: string[]; recyclerId: string; values: Record<string, RecycleValue>; attachmentMediaIds?: string[] }

function fail(): never { throw new RestoredHttpError(0, 'CLIENT_RECYCLE_RESPONSE_INVALID', '回收接口数据不符合已确认契约') }
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const str = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const text = (value: unknown): value is string => typeof value === 'string'
const id = (value: unknown): value is string => str(value) && value.length <= 100 && /^[A-Za-z0-9_-]+$/u.test(value)
const fieldKey = (value: unknown): value is string => str(value) && value.length <= 100 && /^[A-Za-z0-9_:.-]+$/u.test(value)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const nullable = (value: unknown): value is string | null => value === null || str(value)
const value = (item: unknown): item is RecycleValue => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)) || (Array.isArray(item) && item.every(text))
const hash = (item: unknown): item is string => typeof item === 'string' && /^[a-f0-9]{64}$/u.test(item)
const segment = (item: string) => { if (!id(item)) fail(); return encodeURIComponent(item) }

export function parseRecycleCatalog(input: unknown): RecycleCatalogItem[] {
  if (!Array.isArray(input)) fail()
  const rows = input.map(item => {
    const row = object(item)
    if (!row || !exact(row, ['gameCode', 'gameName', 'available', 'blockedReason', 'eligibleRecyclerCount']) || !id(row.gameCode) || !str(row.gameName) || typeof row.available !== 'boolean' || !nullable(row.blockedReason) || !nonnegative(row.eligibleRecyclerCount)) fail()
    return row as RecycleCatalogItem
  })
  if (new Set(rows.map(row => row.gameCode)).size !== rows.length) fail()
  return rows
}

export function parseRecycleGame(input: unknown): RecycleGameDetail {
  const row = object(input)
  if (!row || !exact(row, ['gameCode', 'gameName', 'fieldTemplateVersion', 'fieldSchemaHash', 'fields', 'available', 'blockedReason', 'attachmentsAvailable', 'recyclers']) || !id(row.gameCode) || !str(row.gameName) || !(positive(row.fieldTemplateVersion) || (row.available === false && row.fieldTemplateVersion === 0)) || !(hash(row.fieldSchemaHash) || (row.available === false && row.fieldSchemaHash === '')) || !Array.isArray(row.fields) || (row.available && row.fields.length === 0) || typeof row.available !== 'boolean' || !nullable(row.blockedReason) || typeof row.attachmentsAvailable !== 'boolean' || !Array.isArray(row.recyclers)) fail()
  const fields = row.fields.map(inputField => {
    const field = object(inputField)
    if (!field || !exact(field, ['fieldKey', 'label', 'valueType', 'required', 'options']) || !fieldKey(field.fieldKey) || !str(field.label) || !['text', 'number', 'single', 'multiple'].includes(String(field.valueType)) || typeof field.required !== 'boolean' || !Array.isArray(field.options)) fail()
    const options = field.options.map(inputOption => {
      const option = object(inputOption)
      if (!option || !exact(option, ['label', 'value']) || !str(option.label) || !str(option.value)) fail()
      return option as { label: string; value: string }
    })
    if ((field.valueType === 'single' || field.valueType === 'multiple') !== (options.length > 0) || new Set(options.map(option => option.value)).size !== options.length) fail()
    return { ...field, options } as RecycleField
  })
  if (new Set(fields.map(field => field.fieldKey)).size !== fields.length) fail()
  const recyclers = row.recyclers.map(inputRecycler => {
    const recycler = object(inputRecycler)
    if (!recycler || !exact(recycler, ['recyclerId', 'displayName', 'eligible', 'blockedReason']) || !id(recycler.recyclerId) || !str(recycler.displayName) || typeof recycler.eligible !== 'boolean' || !nullable(recycler.blockedReason)) fail()
    return recycler as RecycleGameDetail['recyclers'][number]
  })
  if (new Set(recyclers.map(recycler => recycler.recyclerId)).size !== recyclers.length) fail()
  return { ...row, fields, recyclers } as RecycleGameDetail
}

export function parseRecycleConsultation(input: unknown): RecycleConsultation {
  const row = object(input)
  if (!row || !exact(row, ['id', 'clientSubmissionId', 'gameCode', 'profileVersion', 'profileFields', 'fieldTemplateVersion', 'fieldSchemaHash', 'recyclerId', 'conversationId', 'status', 'attachments', 'createdAt']) || !id(row.id) || !id(row.clientSubmissionId) || !id(row.gameCode) || row.profileVersion !== 1 || !Array.isArray(row.profileFields) || !positive(row.fieldTemplateVersion) || !hash(row.fieldSchemaHash) || !id(row.recyclerId) || !id(row.conversationId) || row.status !== 'SENT' || !Array.isArray(row.attachments) || row.attachments.length > 15 || !str(row.createdAt) || !Number.isFinite(Date.parse(row.createdAt))) fail()
  const profileFields = row.profileFields.map(inputField => {
    const field = object(inputField)
    if (!field || !exact(field, ['fieldKey', 'label', 'value', 'displayValue']) || !fieldKey(field.fieldKey) || !str(field.label) || !value(field.value) || !text(field.displayValue)) fail()
    return field as RecycleConsultation['profileFields'][number]
  })
  if (new Set(profileFields.map(field => field.fieldKey)).size !== profileFields.length) fail()
  let attachments: RestoredRecycleMedia[]
  try { attachments = row.attachments.map(item => parseRestoredRecycleMedia(item, row.id as string)) }
  catch { fail() }
  if (new Set(attachments.map(item => item.mediaId)).size !== attachments.length) fail()
  return { ...row, profileFields, attachments } as RecycleConsultation
}

export function createRestoredRecycleApi(transport: Pick<ReturnType<typeof createRestoredLinkedTransport>, 'read' | 'write'>) {
  return {
    async listCatalog(signal?: AbortSignal) { return parseRecycleCatalog((await transport.read('/client/recycle/catalog', parseRecycleCatalog, signal)).data) },
    async readGame(gameCode: string, signal?: AbortSignal) {
      const data = parseRecycleGame((await transport.read(`/client/recycle/games/${segment(gameCode)}`, parseRecycleGame, signal)).data)
      if (data.gameCode !== gameCode) fail()
      return data
    },
    async readConsultation(consultationId: string, signal?: AbortSignal) {
      const data = parseRecycleConsultation((await transport.read(`/client/recycle/consultations/${segment(consultationId)}`, parseRecycleConsultation, signal)).data)
      if (data.id !== consultationId) fail()
      return data
    },
    async findTarget(submissionId: string, recyclerId: string, signal?: AbortSignal) {
      const data = parseRecycleConsultation((await transport.read(`/client/recycle/submissions/${segment(submissionId)}/targets/${segment(recyclerId)}`, parseRecycleConsultation, signal)).data)
      if (data.clientSubmissionId !== submissionId || data.recyclerId !== recyclerId) fail()
      return data
    },
    async createConsultation(body: RecycleCreate, key: string, signal?: AbortSignal) {
      const attachmentMediaIds = body.attachmentMediaIds ?? []
      if (!id(body.clientSubmissionId) || body.clientSubmissionId.length < 8 || !id(body.gameCode) || !positive(body.fieldTemplateVersion) || !hash(body.fieldSchemaHash) || !Array.isArray(body.selectedRecyclerIds) || body.selectedRecyclerIds.length < 1 || body.selectedRecyclerIds.length > 100 || !body.selectedRecyclerIds.every(id) || new Set(body.selectedRecyclerIds).size !== body.selectedRecyclerIds.length || !body.selectedRecyclerIds.includes(body.recyclerId) || !object(body.values) || !Object.values(body.values).every(value) || !Array.isArray(attachmentMediaIds) || attachmentMediaIds.length > 15 || !attachmentMediaIds.every(id) || new Set(attachmentMediaIds).size !== attachmentMediaIds.length || !/^[\x21-\x7e]{8,100}$/u.test(key)) fail()
      const data = parseRecycleConsultation((await transport.write('/client/recycle/consultations', body, key, parseRecycleConsultation, signal)).data)
      if (data.clientSubmissionId !== body.clientSubmissionId || data.gameCode !== body.gameCode || data.recyclerId !== body.recyclerId || data.fieldTemplateVersion !== body.fieldTemplateVersion || data.fieldSchemaHash !== body.fieldSchemaHash || data.profileFields.length !== Object.keys(body.values).length || data.profileFields.some(field => !Object.hasOwn(body.values, field.fieldKey) || JSON.stringify(field.value) !== JSON.stringify(body.values[field.fieldKey])) || data.attachments.length !== attachmentMediaIds.length || data.attachments.some((item, index) => item.mediaId !== attachmentMediaIds[index])) fail()
      return data
    },
    async uploadMedia(file: File, key: string, signal?: AbortSignal) { return uploadRestoredRecycleMedia(transport, file, key, signal) },
  }
}
export type RestoredRecycleApi = ReturnType<typeof createRestoredRecycleApi>
