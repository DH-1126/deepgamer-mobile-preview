import { RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'
import { uploadRestoredRecycleMedia, type RestoredRecycleMedia } from './restoredRecycleMedia'

export type RecycleRevisionValue = string | number | string[]
export type RecycleRevisionFieldValueType = 'text' | 'number' | 'single' | 'multiple'
export type RecycleRevisionField = {
  sourceRefType: 'attr' | 'attr_group'
  sourceRefKey: string
  fieldKey: string
  label: string
  valueType: RecycleRevisionFieldValueType
  uiType: string
  order: number
  required: boolean
  options: { label: string; value: string }[]
  multiValues: string[]
}
export type RecycleRevisionProfileField = { fieldKey: string; label: string; value: RecycleRevisionValue; displayValue: string }
export type RecycleProfileRevision = {
  revisionId: string
  requestId: string
  revisionNumber: number
  profileVersion: number
  gameCode: string
  fieldTemplateVersion: number
  fieldSchemaHash: string
  profileFields: RecycleRevisionProfileField[]
  attachments: RestoredRecycleMedia[]
  createdAt: string
}
export type RecycleProfileRevisionListItem = RecycleProfileRevision & { deliveredAt: string | null }
export type RecycleProfileRevisionList = { consultationId: string; requestId: string; canEdit: boolean; revisions: RecycleProfileRevisionListItem[] }
export type RecycleProfileEditContext = {
  requestId: string
  clientSubmissionId: string
  gameCode: string
  canEdit: true
  baseRevisionId: string
  fieldTemplateVersion: number
  fieldSchemaHash: string
  fields: RecycleRevisionField[]
  values: Record<string, RecycleRevisionValue>
  attachments: RestoredRecycleMedia[]
  consultations: { consultationId: string; recyclerId: string; recyclerName: string; conversationId: string; deliveredRevisionId: string; deliveredAt: string }[]
}
export type RecycleRevisionSave = { clientSaveId: string; baseRevisionId: string; values: Record<string, RecycleRevisionValue>; attachmentMediaIds: string[] }
export type RecycleRevisionSaveResult = { clientSaveId: string; unchanged: boolean; revision: RecycleProfileRevision }
export type RecycleRevisionTarget = { clientConfirmationId: string; selectedConsultationIds: string[] }
export type RecycleRevisionTargetResult = RecycleRevisionTarget & { revisionId: string; consultationId: string; deliveryId: string; messageId: string; deliveredAt: string }

type Row = Record<string, unknown>
const fail = (): never => { throw new RestoredHttpError(0, 'CLIENT_RECYCLE_REVISION_RESPONSE_INVALID', '回收资料版本数据不符合已确认契约') }
const object = (input: unknown): Row | null => input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Row : null
const exact = (row: Row, keys: readonly string[]) => Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
const text = (input: unknown): input is string => typeof input === 'string'
const nonempty = (input: unknown, max = 100): input is string => typeof input === 'string' && input.trim().length > 0 && input.length <= max
const integer = (input: unknown, minimum = 1): input is number => typeof input === 'number' && Number.isSafeInteger(input) && input >= minimum
const datetime = (input: unknown): input is string => nonempty(input, 100) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(input) && Number.isFinite(Date.parse(input))
const hash = (input: unknown): input is string => typeof input === 'string' && /^[a-f0-9]{64}$/u.test(input)
const command = (input: unknown): input is string => nonempty(input) && input.trim().length >= 8
const segment = (input: string) => { if (!nonempty(input)) fail(); return encodeURIComponent(input) }
const unique = (input: unknown, maximum: number, minimum = 0): input is string[] => Array.isArray(input) && input.length >= minimum && input.length <= maximum && input.every(item => nonempty(item)) && new Set(input).size === input.length
const revisionValue = (input: unknown): input is RecycleRevisionValue => (typeof input === 'string' && input.length <= 5_000) || (typeof input === 'number' && Number.isFinite(input)) || (Array.isArray(input) && input.length <= 100 && input.every(item => typeof item === 'string' && item.length <= 500))
const values = (input: unknown): input is Record<string, RecycleRevisionValue> => {
  const row = object(input)
  return row !== null && Object.entries(row).every(([key, item]) => key.trim().length > 0 && key.length <= 200 && revisionValue(item))
}

function expectedMediaUrl(consultationId: string, revisionId: string, mediaId: string) {
  return `/api/v1/client/recycle/consultations/${encodeURIComponent(consultationId)}/revisions/${encodeURIComponent(revisionId)}/media/${encodeURIComponent(mediaId)}/content`
}

function parseMedia(input: unknown, revisionId: string, consultationId?: string): RestoredRecycleMedia {
  const row = object(input)
  if (!row || !exact(row, ['mediaId', 'mimeType', 'sizeBytes', 'width', 'height', 'contentUrl', 'createdAt']) || !nonempty(row.mediaId)
    || !['image/png', 'image/jpeg', 'image/webp'].includes(String(row.mimeType)) || !integer(row.sizeBytes) || Number(row.sizeBytes) >= 1_048_576
    || !(row.width === null || integer(row.width)) || !(row.height === null || integer(row.height)) || !datetime(row.createdAt) || !nonempty(row.contentUrl, 1_000)) fail()
  const checked = row as unknown as RestoredRecycleMedia
  if (consultationId !== undefined) {
    if (checked.contentUrl !== expectedMediaUrl(consultationId, revisionId, checked.mediaId)) fail()
  } else {
    if (checked.contentUrl !== `/api/v1/client/recycle/media/${encodeURIComponent(checked.mediaId)}/content`) fail()
  }
  return checked
}

export function parseRecycleProfileRevision(input: unknown, consultationId?: string): RecycleProfileRevision {
  const row = object(input)
  if (!row || !exact(row, ['revisionId', 'requestId', 'revisionNumber', 'profileVersion', 'gameCode', 'fieldTemplateVersion', 'fieldSchemaHash', 'profileFields', 'attachments', 'createdAt'])
    || !nonempty(row.revisionId) || !nonempty(row.requestId) || !integer(row.revisionNumber) || !integer(row.profileVersion) || !nonempty(row.gameCode)
    || !integer(row.fieldTemplateVersion) || !hash(row.fieldSchemaHash) || !Array.isArray(row.profileFields) || row.profileFields.length > 100
    || !Array.isArray(row.attachments) || row.attachments.length > 15 || !datetime(row.createdAt)) fail()
  const checked = row as unknown as Omit<RecycleProfileRevision, 'profileFields' | 'attachments'> & { profileFields: unknown[]; attachments: unknown[] }
  const profileFields = checked.profileFields.map(item => {
    const field = object(item)
    if (!field || !exact(field, ['fieldKey', 'label', 'value', 'displayValue']) || !nonempty(field.fieldKey, 200) || !nonempty(field.label, 200) || !revisionValue(field.value) || !text(field.displayValue) || field.displayValue.length > 5_000) fail()
    return field as RecycleRevisionProfileField
  })
  if (new Set(profileFields.map(field => field.fieldKey)).size !== profileFields.length) fail()
  const attachments = checked.attachments.map(item => parseMedia(item, checked.revisionId, consultationId))
  if (new Set(attachments.map(item => item.mediaId)).size !== attachments.length) fail()
  return { ...checked, profileFields, attachments }
}

export function parseRecycleProfileRevisionList(input: unknown, consultationId: string): RecycleProfileRevisionList {
  const row = object(input)
  if (!row || !exact(row, ['consultationId', 'requestId', 'canEdit', 'revisions']) || row.consultationId !== consultationId || !nonempty(row.requestId) || typeof row.canEdit !== 'boolean' || !Array.isArray(row.revisions)) fail()
  const checked = row as unknown as { consultationId: string; requestId: string; canEdit: boolean; revisions: unknown[] }
  const revisions = checked.revisions.map(item => {
    const itemRow = object(item)
    if (!itemRow || !Object.hasOwn(itemRow, 'deliveredAt')) fail()
    const { deliveredAt, ...base } = itemRow as Row & { deliveredAt: unknown }
    if (!(deliveredAt === null || datetime(deliveredAt))) fail()
    return { ...parseRecycleProfileRevision(base, consultationId), deliveredAt } as RecycleProfileRevisionListItem
  })
  if (new Set(revisions.map(item => item.revisionId)).size !== revisions.length) fail()
  return { consultationId, requestId: checked.requestId, canEdit: checked.canEdit, revisions }
}

export function parseRecycleProfileEditContext(input: unknown, consultationId?: string): RecycleProfileEditContext {
  const row = object(input)
  if (!row || !exact(row, ['requestId', 'clientSubmissionId', 'gameCode', 'canEdit', 'baseRevisionId', 'fieldTemplateVersion', 'fieldSchemaHash', 'fields', 'values', 'attachments', 'consultations'])
    || !nonempty(row.requestId) || !nonempty(row.clientSubmissionId) || !nonempty(row.gameCode) || row.canEdit !== true || !nonempty(row.baseRevisionId)
    || !integer(row.fieldTemplateVersion) || !hash(row.fieldSchemaHash) || !Array.isArray(row.fields) || row.fields.length > 100 || !values(row.values)
    || !Array.isArray(row.attachments) || row.attachments.length > 15 || !Array.isArray(row.consultations) || row.consultations.length > 100) fail()
  const checked = row as unknown as Omit<RecycleProfileEditContext, 'fields' | 'attachments' | 'consultations'> & { fields: unknown[]; attachments: unknown[]; consultations: unknown[] }
  const fields = checked.fields.map(item => {
    const field = object(item)
    if (!field || !exact(field, ['sourceRefType', 'sourceRefKey', 'fieldKey', 'label', 'valueType', 'uiType', 'order', 'required', 'options', 'multiValues'])
      || !['attr', 'attr_group'].includes(String(field.sourceRefType)) || !nonempty(field.sourceRefKey, 150) || !nonempty(field.fieldKey, 200) || !nonempty(field.label, 200)
      || !nonempty(field.valueType) || !nonempty(field.uiType) || !integer(field.order, 0) || typeof field.required !== 'boolean' || !Array.isArray(field.options) || field.options.length > 500 || !Array.isArray(field.multiValues) || field.multiValues.length > 500 || !field.multiValues.every(item => text(item) && item.length <= 500)) fail()
    const rawField = field as unknown as Omit<RecycleRevisionField, 'valueType' | 'options'> & { valueType: string; options: unknown[] }
    const options = rawField.options.map(optionInput => {
      const option = object(optionInput)
      if (!option || !exact(option, ['label', 'value']) || !text(option.label) || option.label.length > 500 || !text(option.value) || option.value.length > 500) fail()
      return option as { label: string; value: string }
    })
    if (new Set(options.map(option => option.value)).size !== options.length || rawField.multiValues.length !== 0) fail()
    const rawValueType = rawField.valueType.toUpperCase()
    const uiType = rawField.uiType.toLowerCase()
    const valueType: RecycleRevisionFieldValueType = (() => {
      if ((rawValueType === 'STRING' || rawValueType === 'TEXT') && ['input', 'text', 'textarea'].includes(uiType) && options.length === 0) return 'text'
      if (rawValueType === 'NUMBER' && uiType === 'number' && options.length === 0) return 'number'
      if (rawValueType === 'ENUM' && ['select', 'radio'].includes(uiType) && options.length > 0) return 'single'
      if (rawValueType === 'ENUM' && uiType === 'checkbox' && options.length > 0) return 'multiple'
      return fail()
    })()
    return { ...rawField, valueType, options }
  }).sort((left, right) => left.order - right.order)
  const attachments = checked.attachments.map(item => parseMedia(item, checked.baseRevisionId, consultationId))
  const consultations = checked.consultations.map(item => {
    const target = object(item)
    if (!target || !exact(target, ['consultationId', 'recyclerId', 'recyclerName', 'conversationId', 'deliveredRevisionId', 'deliveredAt']) || !nonempty(target.consultationId) || !nonempty(target.recyclerId) || !nonempty(target.recyclerName, 200) || !nonempty(target.conversationId) || !nonempty(target.deliveredRevisionId) || !datetime(target.deliveredAt)) fail()
    return target as RecycleProfileEditContext['consultations'][number]
  })
  if (new Set(fields.map(field => field.fieldKey)).size !== fields.length || new Set(attachments.map(item => item.mediaId)).size !== attachments.length || new Set(consultations.map(item => item.consultationId)).size !== consultations.length) fail()
  return { ...checked, fields, attachments, consultations }
}

function parseSaveResult(input: unknown, consultationId?: string): RecycleRevisionSaveResult {
  const row = object(input)
  if (!row || !exact(row, ['clientSaveId', 'unchanged', 'revision']) || !command(row.clientSaveId) || typeof row.unchanged !== 'boolean') fail()
  const checked = row as unknown as { clientSaveId: string; unchanged: boolean; revision: unknown }
  return { clientSaveId: checked.clientSaveId, unchanged: checked.unchanged, revision: parseRecycleProfileRevision(checked.revision, consultationId) }
}

function parseTargetResult(input: unknown): RecycleRevisionTargetResult {
  const row = object(input)
  if (!row || !exact(row, ['clientConfirmationId', 'revisionId', 'selectedConsultationIds', 'consultationId', 'deliveryId', 'messageId', 'deliveredAt']) || !command(row.clientConfirmationId) || !nonempty(row.revisionId)
    || !unique(row.selectedConsultationIds, 100, 1) || !nonempty(row.consultationId) || !nonempty(row.deliveryId) || !nonempty(row.messageId) || !datetime(row.deliveredAt)) fail()
  return row as RecycleRevisionTargetResult
}

function validateSave(body: RecycleRevisionSave) {
  if (!command(body.clientSaveId) || !nonempty(body.baseRevisionId) || !values(body.values) || !unique(body.attachmentMediaIds, 15)) fail()
}
function validateTarget(body: RecycleRevisionTarget) {
  if (!command(body.clientConfirmationId) || !unique(body.selectedConsultationIds, 100, 1)) fail()
}

export function createRestoredRecycleRevisionApi(transport: Pick<ReturnType<typeof createRestoredLinkedTransport>, 'read' | 'write'>) {
  return {
    async listRevisions(consultationId: string, signal?: AbortSignal) {
      const path = `/client/recycle/consultations/${segment(consultationId)}/revisions`
      return parseRecycleProfileRevisionList((await transport.read(path, value => parseRecycleProfileRevisionList(value, consultationId), signal)).data, consultationId)
    },
    async readRevision(consultationId: string, revisionId: string, signal?: AbortSignal) {
      const path = `/client/recycle/consultations/${segment(consultationId)}/revisions/${segment(revisionId)}`
      const result = parseRecycleProfileRevision((await transport.read(path, value => parseRecycleProfileRevision(value, consultationId), signal)).data, consultationId)
      if (result.revisionId !== revisionId) fail()
      return result
    },
    async readEditContext(consultationId: string, signal?: AbortSignal) {
      const path = `/client/recycle/consultations/${segment(consultationId)}/profile-edit-context`
      return (await transport.read(path, value => parseRecycleProfileEditContext(value, consultationId), signal)).data
    },
    async saveRevision(requestId: string, body: RecycleRevisionSave, key: string, signal?: AbortSignal) {
      validateSave(body)
      const result = parseSaveResult((await transport.write(`/client/recycle/requests/${segment(requestId)}/revisions`, body, key, parseSaveResult, signal)).data)
      if (result.clientSaveId !== body.clientSaveId || result.revision.requestId !== requestId) fail()
      return result
    },
    async findSaveOperation(requestId: string, clientSaveId: string, signal?: AbortSignal) {
      if (!command(clientSaveId)) fail()
      const result = parseSaveResult((await transport.read(`/client/recycle/requests/${segment(requestId)}/revision-operations/${segment(clientSaveId)}`, parseSaveResult, signal)).data)
      if (result.clientSaveId !== clientSaveId || result.revision.requestId !== requestId) fail()
      return result
    },
    async deliverRevision(revisionId: string, consultationId: string, body: RecycleRevisionTarget, key: string, signal?: AbortSignal) {
      validateTarget(body)
      const result = parseTargetResult((await transport.write(`/client/recycle/revisions/${segment(revisionId)}/targets/${segment(consultationId)}`, body, key, parseTargetResult, signal)).data)
      if (result.revisionId !== revisionId || result.consultationId !== consultationId || result.clientConfirmationId !== body.clientConfirmationId || JSON.stringify(result.selectedConsultationIds) !== JSON.stringify(body.selectedConsultationIds)) fail()
      return result
    },
    async findTargetOperation(revisionId: string, consultationId: string, clientConfirmationId: string, selectedConsultationIds: string[], signal?: AbortSignal) {
      if (!command(clientConfirmationId) || !unique(selectedConsultationIds, 100, 1)) fail()
      const path = `/client/recycle/revisions/${segment(revisionId)}/targets/${segment(consultationId)}?clientConfirmationId=${encodeURIComponent(clientConfirmationId)}`
      const result = parseTargetResult((await transport.read(path, parseTargetResult, signal)).data)
      if (result.revisionId !== revisionId || result.consultationId !== consultationId || result.clientConfirmationId !== clientConfirmationId || JSON.stringify(result.selectedConsultationIds) !== JSON.stringify(selectedConsultationIds)) fail()
      return result
    },
    async uploadMedia(file: File, key: string, signal?: AbortSignal) { return uploadRestoredRecycleMedia(transport, file, key, signal) },
  }
}

export type RestoredRecycleRevisionApi = ReturnType<typeof createRestoredRecycleRevisionApi>
