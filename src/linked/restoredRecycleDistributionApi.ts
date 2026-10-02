import { RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'
import {
  parseRecycleProfileEditContext,
  parseRecycleProfileRevision,
  type RecycleProfileEditContext,
  type RecycleProfileRevision,
  type RecycleRevisionValue,
} from './restoredRecycleRevisionApi'

export type RecycleProfileRequestCreate = {
  clientRequestId: string
  gameCode: string
  fieldTemplateVersion: number
  fieldSchemaHash: string
  values: Record<string, RecycleRevisionValue>
  attachmentMediaIds: string[]
}
export type RecycleProfileRequestSummary = {
  requestId: string
  clientSubmissionId: string
  gameCode: string
  latestRevisionId: string
  latestProfileVersion: number
  createdAt: string
}
export type RecycleProfileRequestCreateResult = {
  clientRequestId: string
  created: boolean
  request: RecycleProfileRequestSummary
  revision: RecycleProfileRevision
}
export type RecycleDistributionConfirmation = { clientDistributionId: string; selectedRecyclerIds: string[] }
export type RecycleDistributionTarget = {
  recyclerId: string
  recyclerName: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  consultationId: string | null
  conversationId: string | null
  deliveryId: string | null
  messageId: string | null
  deliveredAt: string | null
  errorCode: string | null
  errorMessage: string | null
}
export type RecycleDistribution = {
  clientDistributionId: string
  requestId: string
  revisionId: string
  selectedRecyclerIds: string[]
  targets: RecycleDistributionTarget[]
  createdAt: string
}
export type RecycleInitialProfile = {
  consultationId: string
  clientSubmissionId: string
  requestId: string
  revisionId: string
  profileVersion: number
  gameCode: string
  profileFields: RecycleProfileRevision['profileFields']
  fieldTemplateVersion: number
  fieldSchemaHash: string
  recyclerId: string
  conversationId: string
  attachments: RecycleProfileRevision['attachments']
  status: 'SENT'
  createdAt: string
  deliveredAt: string
}

type Row = Record<string, unknown>
const fail = (): never => { throw new RestoredHttpError(0, 'CLIENT_RECYCLE_DISTRIBUTION_RESPONSE_INVALID', '回收资料分发数据不符合已确认契约') }
const object = (input: unknown): Row | null => input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Row : null
const exact = (row: Row, keys: readonly string[]) => Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
const text = (input: unknown, max = 100): input is string => typeof input === 'string' && input.trim().length > 0 && input.length <= max
const integer = (input: unknown): input is number => typeof input === 'number' && Number.isSafeInteger(input) && input > 0
const datetime = (input: unknown): input is string => text(input) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(input) && Number.isFinite(Date.parse(input))
const hash = (input: unknown): input is string => typeof input === 'string' && /^[a-f0-9]{64}$/u.test(input)
const command = (input: unknown): input is string => text(input) && input.trim().length >= 8
const segment = (input: string) => { if (!text(input)) fail(); return encodeURIComponent(input) }
const unique = (input: unknown, minimum = 0): input is string[] => Array.isArray(input) && input.length >= minimum && input.length <= 100 && input.every(item => text(item)) && new Set(input).size === input.length
const value = (input: unknown): input is RecycleRevisionValue => (typeof input === 'string' && input.length <= 5_000) || (typeof input === 'number' && Number.isFinite(input)) || (Array.isArray(input) && input.length <= 100 && input.every(item => typeof item === 'string' && item.length <= 500))
const values = (input: unknown): input is Record<string, RecycleRevisionValue> => {
  const row = object(input)
  return row !== null && Object.entries(row).every(([key, item]) => key.trim().length > 0 && key.length <= 200 && value(item))
}

function parseRequestSummary(input: unknown): RecycleProfileRequestSummary {
  const row = object(input)
  if (!row || !exact(row, ['requestId', 'clientSubmissionId', 'gameCode', 'latestRevisionId', 'latestProfileVersion', 'createdAt'])
    || !text(row.requestId) || !text(row.clientSubmissionId) || !text(row.gameCode) || !text(row.latestRevisionId)
    || !integer(row.latestProfileVersion) || !datetime(row.createdAt)) fail()
  return row as RecycleProfileRequestSummary
}

function parseRequestResult(input: unknown): RecycleProfileRequestCreateResult {
  const row = object(input)
  if (!row || !exact(row, ['clientRequestId', 'created', 'request', 'revision']) || !command(row.clientRequestId) || typeof row.created !== 'boolean') fail()
  const checked = row as { clientRequestId: string; created: boolean; request: unknown; revision: unknown }
  const request = parseRequestSummary(checked.request)
  const revision = parseRecycleProfileRevision(checked.revision)
  if (request.requestId !== revision.requestId || request.latestRevisionId !== revision.revisionId
    || request.latestProfileVersion !== revision.profileVersion || request.gameCode !== revision.gameCode) fail()
  return { clientRequestId: checked.clientRequestId, created: checked.created, request, revision }
}

function parseTarget(input: unknown): RecycleDistributionTarget {
  const row = object(input)
  if (!row || !exact(row, ['recyclerId', 'recyclerName', 'status', 'consultationId', 'conversationId', 'deliveryId', 'messageId', 'deliveredAt', 'errorCode', 'errorMessage'])
    || !text(row.recyclerId) || !text(row.recyclerName, 200) || !['PENDING', 'SUCCESS', 'FAILED'].includes(String(row.status))
    || !(row.consultationId === null || text(row.consultationId)) || !(row.conversationId === null || text(row.conversationId))
    || !(row.deliveryId === null || text(row.deliveryId)) || !(row.messageId === null || text(row.messageId))
    || !(row.deliveredAt === null || datetime(row.deliveredAt)) || !(row.errorCode === null || text(row.errorCode))
    || !(row.errorMessage === null || text(row.errorMessage, 500))) fail()
  const target = row as RecycleDistributionTarget
  const persisted = [target.consultationId, target.conversationId, target.deliveryId, target.messageId, target.deliveredAt]
  if (target.status === 'SUCCESS' && (persisted.some(item => item === null) || target.errorCode !== null || target.errorMessage !== null)) fail()
  if (target.status === 'PENDING' && (persisted.some(item => item !== null) || target.errorCode !== null || target.errorMessage !== null)) fail()
  if (target.status === 'FAILED' && (!target.errorCode || !target.errorMessage || target.deliveryId !== null || target.messageId !== null || target.deliveredAt !== null)) fail()
  return target
}

function parseDistribution(input: unknown): RecycleDistribution {
  const row = object(input)
  if (!row || !exact(row, ['clientDistributionId', 'requestId', 'revisionId', 'selectedRecyclerIds', 'targets', 'createdAt'])
    || !command(row.clientDistributionId) || !text(row.requestId) || !text(row.revisionId) || !unique(row.selectedRecyclerIds, 1)
    || !Array.isArray(row.targets) || row.targets.length === 0 || row.targets.length > 100 || !datetime(row.createdAt)) fail()
  const checked = row as { clientDistributionId: string; requestId: string; revisionId: string; selectedRecyclerIds: string[]; targets: unknown[]; createdAt: string }
  const targets = checked.targets.map(parseTarget)
  const selectedRecyclerIds = checked.selectedRecyclerIds
  const targetIds = targets.map(item => item.recyclerId)
  if (new Set(targetIds).size !== targetIds.length || JSON.stringify([...targetIds].sort()) !== JSON.stringify([...selectedRecyclerIds].sort())) fail()
  return { ...checked, selectedRecyclerIds, targets }
}

function parseInitialProfile(input: unknown, consultationId: string): RecycleInitialProfile {
  const row = object(input)
  if (!row || !exact(row, ['consultationId', 'clientSubmissionId', 'requestId', 'revisionId', 'profileVersion', 'gameCode', 'profileFields', 'fieldTemplateVersion', 'fieldSchemaHash', 'recyclerId', 'conversationId', 'attachments', 'status', 'createdAt', 'deliveredAt'])
    || row.consultationId !== consultationId || !text(row.clientSubmissionId) || !text(row.requestId) || !text(row.revisionId)
    || !integer(row.profileVersion) || !text(row.gameCode) || !integer(row.fieldTemplateVersion) || !hash(row.fieldSchemaHash)
    || !text(row.recyclerId) || !text(row.conversationId) || row.status !== 'SENT' || !datetime(row.createdAt) || !datetime(row.deliveredAt)) fail()
  const checked = row as unknown as Omit<RecycleInitialProfile, 'profileFields' | 'attachments'> & { profileFields: unknown; attachments: unknown }
  const revision = parseRecycleProfileRevision({
    revisionId: checked.revisionId, requestId: checked.requestId, revisionNumber: checked.profileVersion, profileVersion: checked.profileVersion,
    gameCode: checked.gameCode, fieldTemplateVersion: checked.fieldTemplateVersion, fieldSchemaHash: checked.fieldSchemaHash,
    profileFields: checked.profileFields, attachments: checked.attachments, createdAt: checked.createdAt,
  }, consultationId)
  return { ...checked, profileFields: revision.profileFields, attachments: revision.attachments }
}

function validateRequest(body: RecycleProfileRequestCreate) {
  if (!command(body.clientRequestId) || !text(body.gameCode) || !integer(body.fieldTemplateVersion) || !hash(body.fieldSchemaHash)
    || !values(body.values) || !unique(body.attachmentMediaIds) || body.attachmentMediaIds.length > 15) fail()
}
function validateConfirmation(body: RecycleDistributionConfirmation) {
  if (!command(body.clientDistributionId) || !unique(body.selectedRecyclerIds, 1)) fail()
}

export function createRestoredRecycleDistributionApi(transport: Pick<ReturnType<typeof createRestoredLinkedTransport>, 'read' | 'write'>) {
  return {
    async createRequest(body: RecycleProfileRequestCreate, key: string, signal?: AbortSignal) {
      validateRequest(body)
      const result = parseRequestResult((await transport.write('/client/recycle/profile-requests', body, key, parseRequestResult, signal)).data)
      if (result.clientRequestId !== body.clientRequestId || result.request.gameCode !== body.gameCode) fail()
      return result
    },
    async findRequestOperation(clientRequestId: string, signal?: AbortSignal) {
      if (!command(clientRequestId)) fail()
      const result = parseRequestResult((await transport.read(`/client/recycle/profile-request-operations/${segment(clientRequestId)}`, parseRequestResult, signal)).data)
      if (result.clientRequestId !== clientRequestId) fail()
      return result
    },
    async listRequests(signal?: AbortSignal) {
      const raw = (await transport.read('/client/recycle/profile-requests', input => input, signal)).data
      const row = object(raw)
      if (!row || !exact(row, ['requests']) || !Array.isArray(row.requests)) fail()
      const requests = (row as { requests: unknown[] }).requests.map(parseRequestSummary)
      if (new Set(requests.map(item => item.requestId)).size !== requests.length) fail()
      return requests
    },
    async readRequestContext(requestId: string, signal?: AbortSignal): Promise<RecycleProfileEditContext> {
      const path = `/client/recycle/profile-requests/${segment(requestId)}/edit-context`
      const context = (await transport.read(path, value => parseRecycleProfileEditContext(value), signal)).data
      if (context.requestId !== requestId) fail()
      return context
    },
    async listRequestRevisions(requestId: string, signal?: AbortSignal) {
      const path = `/client/recycle/profile-requests/${segment(requestId)}/revisions`
      const raw = (await transport.read(path, input => input, signal)).data
      const row = object(raw)
      if (!row || !exact(row, ['requestId', 'canEdit', 'revisions']) || row.requestId !== requestId || row.canEdit !== true || !Array.isArray(row.revisions)) fail()
      const revisions = (row as { requestId: string; canEdit: true; revisions: unknown[] }).revisions.map(item => parseRecycleProfileRevision(item))
      if (new Set(revisions.map(item => item.revisionId)).size !== revisions.length || revisions.some(item => item.requestId !== requestId)) fail()
      return revisions
    },
    async confirmDistribution(revisionId: string, body: RecycleDistributionConfirmation, key: string, signal?: AbortSignal) {
      validateConfirmation(body)
      const result = parseDistribution((await transport.write(`/client/recycle/revisions/${segment(revisionId)}/distributions`, body, key, parseDistribution, signal)).data)
      if (result.revisionId !== revisionId || result.clientDistributionId !== body.clientDistributionId
        || JSON.stringify(result.selectedRecyclerIds) !== JSON.stringify(body.selectedRecyclerIds)) fail()
      return result
    },
    async findDistribution(revisionId: string, clientDistributionId: string, signal?: AbortSignal) {
      if (!command(clientDistributionId)) fail()
      const result = parseDistribution((await transport.read(`/client/recycle/revisions/${segment(revisionId)}/distributions/${segment(clientDistributionId)}`, parseDistribution, signal)).data)
      if (result.revisionId !== revisionId || result.clientDistributionId !== clientDistributionId) fail()
      return result
    },
    async executeTarget(revisionId: string, clientDistributionId: string, recyclerId: string, key: string, signal?: AbortSignal) {
      const path = `/client/recycle/revisions/${segment(revisionId)}/distributions/${segment(clientDistributionId)}/targets/${segment(recyclerId)}`
      const result = parseTarget((await transport.write(path, {}, key, parseTarget, signal)).data)
      if (result.recyclerId !== recyclerId) fail()
      return result
    },
    async findTarget(revisionId: string, clientDistributionId: string, recyclerId: string, signal?: AbortSignal) {
      const path = `/client/recycle/revisions/${segment(revisionId)}/distributions/${segment(clientDistributionId)}/targets/${segment(recyclerId)}`
      const result = parseTarget((await transport.read(path, parseTarget, signal)).data)
      if (result.recyclerId !== recyclerId) fail()
      return result
    },
    async readInitialProfile(consultationId: string, signal?: AbortSignal) {
      const path = `/client/recycle/consultations/${segment(consultationId)}/initial-profile`
      return (await transport.read(path, value => parseInitialProfile(value, consultationId), signal)).data
    },
  }
}

export type RestoredRecycleDistributionApi = ReturnType<typeof createRestoredRecycleDistributionApi>
