import { collectRestoredPages, RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'
import {
  buildRestoredPublishForm,
  parseRestoredPublicPublishConfig,
  parseRestoredPublishDirectory,
  type RestoredPublishForm,
} from './restoredPublish'

type Transport = ReturnType<typeof createRestoredLinkedTransport>
type RecordValue = Record<string, unknown>

export interface RestoredGoodsFieldReference {
  id: string
  goodsId: string
  configVersionId: string
  refType: 'ATTRIBUTE' | 'GROUP'
  refKey: string
  refNameAtWrite: string | null
  valueType: 'ENUM' | 'NUMBER' | 'TEXT' | 'BOOLEAN' | 'DATETIME' | 'GROUP_SET'
  value: unknown
  matchedCount: number | null
  evidenceKind: string
  evidenceRef: string
  rowVersion: number
  createdAt: string
  updatedAt: string
}

export interface RestoredOwnedGoods {
  id: string
  goodsNo: string
  game: { id: string; code: string; name: string }
  sellerRef: string
  title: string
  description: string
  priceFen: number
  currency: 'CNY'
  productStatus: 'ON_SALE' | 'OFF_SHELF' | 'SOLD'
  auditStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO'
  currentAudit: {
    auditId: string
    submittedContentRevision: number
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_MORE_INFO'
    rowVersion: number
    reviewReason: string | null
    submittedAt: string
    decidedAt: string | null
    snapshotId: string | null
  } | null
  cover: { mediaId: string; contentUrl: string } | null
  images: Array<{ mediaId: string; contentUrl: string }>
  highlightTags: string[]
  servicePromiseTags: string[]
  publishRevisionId: string
  configVersionId: string
  fields: RestoredGoodsFieldReference[]
  rowVersion: number
  contentRevision: number
  capabilities: { canEdit: boolean; canSubmit: boolean; canOffShelf: boolean; disabledReason: string | null }
  createdAt: string
  updatedAt: string
}

export interface RestoredGoodsFieldInput {
  sourceType: 'ATTRIBUTE' | 'GROUP'
  sourceKey: string
  valueType: 'ENUM' | 'NUMBER' | 'TEXT' | 'BOOLEAN' | 'DATETIME' | 'GROUP_SET'
  value: unknown
}

export interface RestoredCreateGoodsDraftInput {
  gameCode: string
  title: string
  description: string
  priceFen: number
  coverMediaId: string | null
  imageMediaIds: string[]
  highlightTags: string[]
  servicePromiseTags: string[]
  publishRevisionId: string
  configVersionId: string
  fields: RestoredGoodsFieldInput[]
  reason: string
}

export interface RestoredPatchGoodsDraftInput extends Omit<RestoredCreateGoodsDraftInput, 'gameCode'> {
  rowVersion: number
  contentRevision: number
}

export interface RestoredGoodsAuditSubmission {
  auditId: string
  submissionNo: number
  status: 'PENDING'
  submittedAt: string
  auditRowVersion: number
  snapshotAvailability: 'AVAILABLE'
  snapshot: { id: string; goodsId: string; contentRevision: number; purpose: 'AUDIT_SUBMISSION'; schemaHash: string; createdAt: string }
}

export interface RestoredPublicGame {
  id: string
  code: string
  name: string
  status: 'ACTIVE'
  rowVersion: number
  sortOrder: number
  iconUrl: string | null
}

function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function parseMedia(value: unknown): { mediaId: string; contentUrl: string } | null {
  const row = object(value)
  const mediaId = string(row?.mediaId), contentUrl = string(row?.contentUrl)
  return mediaId && contentUrl ? { mediaId, contentUrl } : null
}

function parseFieldReference(value: unknown): RestoredGoodsFieldReference {
  const row = object(value)
  const refType = row?.refType, valueType = row?.valueType
  if (!row || !['ATTRIBUTE', 'GROUP'].includes(String(refType)) || !['ENUM', 'NUMBER', 'TEXT', 'BOOLEAN', 'DATETIME', 'GROUP_SET'].includes(String(valueType))
    || !positiveInteger(row.rowVersion) || !nullableString(row.refNameAtWrite) || !(row.matchedCount === null || nonnegativeInteger(row.matchedCount))) {
    throw new Error('商品字段引用不符合契约')
  }
  const required = ['id', 'goodsId', 'configVersionId', 'refKey', 'evidenceKind', 'evidenceRef', 'createdAt', 'updatedAt'].map(key => string(row[key]))
  if (required.some(value => !value)) throw new Error('商品字段引用不符合契约')
  return {
    id: required[0]!, goodsId: required[1]!, configVersionId: required[2]!, refType: refType as RestoredGoodsFieldReference['refType'],
    refKey: required[3]!, refNameAtWrite: row.refNameAtWrite, valueType: valueType as RestoredGoodsFieldReference['valueType'], value: row.value,
    matchedCount: row.matchedCount, evidenceKind: required[4]!, evidenceRef: required[5]!, rowVersion: row.rowVersion,
    createdAt: required[6]!, updatedAt: required[7]!,
  }
}

function invalidOwnedGoods(): never {
  throw new Error('本人商品数据不符合契约')
}

export function parseRestoredOwnedGoods(value: unknown): RestoredOwnedGoods {
  const row = object(value), game = object(row?.game), capabilities = object(row?.capabilities)
  if (!row || !game || !capabilities || !positiveInteger(row.rowVersion) || !positiveInteger(row.contentRevision)
    || typeof row.priceFen !== 'number' || !Number.isSafeInteger(row.priceFen) || row.priceFen <= 0 || row.currency !== 'CNY'
    || typeof row.description !== 'string' || row.description.length > 10_000
    || !['ON_SALE', 'OFF_SHELF', 'SOLD'].includes(String(row.productStatus))
    || !['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO'].includes(String(row.auditStatus))
    || typeof capabilities.canEdit !== 'boolean' || typeof capabilities.canSubmit !== 'boolean' || typeof capabilities.canOffShelf !== 'boolean'
    || !nullableString(capabilities.disabledReason) || !Array.isArray(row.images) || !Array.isArray(row.fields)
    || !stringArray(row.highlightTags) || !stringArray(row.servicePromiseTags)) invalidOwnedGoods()
  const required = ['id', 'goodsNo', 'sellerRef', 'title', 'publishRevisionId', 'configVersionId', 'createdAt', 'updatedAt'].map(key => string(row[key]))
  const gameRequired = ['id', 'code', 'name'].map(key => string(game[key]))
  if (required.some(value => !value) || gameRequired.some(value => !value)) invalidOwnedGoods()
  let currentAudit: RestoredOwnedGoods['currentAudit'] = null
  if (row.currentAudit !== null) {
    const audit = object(row.currentAudit)
    if (!audit || !string(audit.auditId) || !positiveInteger(audit.submittedContentRevision) || !positiveInteger(audit.rowVersion)
      || !['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO'].includes(String(audit.status))
      || !nullableString(audit.reviewReason) || !string(audit.submittedAt) || !nullableString(audit.decidedAt) || !nullableString(audit.snapshotId)) invalidOwnedGoods()
    currentAudit = {
      auditId: audit.auditId as string, submittedContentRevision: audit.submittedContentRevision, status: audit.status as NonNullable<RestoredOwnedGoods['currentAudit']>['status'],
      rowVersion: audit.rowVersion, reviewReason: audit.reviewReason, submittedAt: audit.submittedAt as string,
      decidedAt: audit.decidedAt, snapshotId: audit.snapshotId,
    }
  }
  const cover = row.cover === null ? null : parseMedia(row.cover)
  const images = row.images.map(parseMedia)
  if (row.cover !== null && !cover || images.some(item => !item)) invalidOwnedGoods()
  return {
    id: required[0]!, goodsNo: required[1]!, game: { id: gameRequired[0]!, code: gameRequired[1]!, name: gameRequired[2]! }, sellerRef: required[2]!,
    title: required[3]!, description: row.description, priceFen: row.priceFen, currency: 'CNY', productStatus: row.productStatus as RestoredOwnedGoods['productStatus'],
    auditStatus: row.auditStatus as RestoredOwnedGoods['auditStatus'], currentAudit, cover, images: images as Array<{ mediaId: string; contentUrl: string }>,
    highlightTags: row.highlightTags, servicePromiseTags: row.servicePromiseTags, publishRevisionId: required[4]!, configVersionId: required[5]!,
    fields: row.fields.map(parseFieldReference), rowVersion: row.rowVersion, contentRevision: row.contentRevision,
    capabilities: { canEdit: capabilities.canEdit, canSubmit: capabilities.canSubmit, canOffShelf: capabilities.canOffShelf, disabledReason: capabilities.disabledReason },
    createdAt: required[6]!, updatedAt: required[7]!,
  }
}

function parseOwnedGoodsArray(value: unknown): RestoredOwnedGoods[] {
  if (!Array.isArray(value)) invalidOwnedGoods()
  return value.map(parseRestoredOwnedGoods)
}

function parsePublicGames(value: unknown): RestoredPublicGame[] {
  if (!Array.isArray(value)) throw new Error('游戏目录数据不符合契约')
  return value.map(item => {
    const row = object(item)
    if (!row || !string(row.id) || !string(row.code) || !string(row.name) || row.status !== 'ACTIVE'
      || !positiveInteger(row.rowVersion) || !nonnegativeInteger(row.sortOrder) || !nullableString(row.iconUrl)) {
      throw new Error('游戏目录数据不符合契约')
    }
    return { id: row.id as string, code: row.code as string, name: row.name as string, status: 'ACTIVE' as const, rowVersion: row.rowVersion, sortOrder: row.sortOrder, iconUrl: row.iconUrl }
  })
}

function parseAuditSubmission(value: unknown): RestoredGoodsAuditSubmission {
  const row = object(value), snapshot = object(row?.snapshot)
  if (!row || !snapshot || row.status !== 'PENDING' || row.snapshotAvailability !== 'AVAILABLE' || !string(row.auditId)
    || !positiveInteger(row.submissionNo) || !string(row.submittedAt) || !positiveInteger(row.auditRowVersion)
    || !string(snapshot.id) || !string(snapshot.goodsId) || !positiveInteger(snapshot.contentRevision) || snapshot.purpose !== 'AUDIT_SUBMISSION'
    || !string(snapshot.schemaHash) || !string(snapshot.createdAt)) throw new Error('商品送审结果不符合契约')
  return {
    auditId: row.auditId as string, submissionNo: row.submissionNo, status: 'PENDING', submittedAt: row.submittedAt as string,
    auditRowVersion: row.auditRowVersion, snapshotAvailability: 'AVAILABLE',
    snapshot: { id: snapshot.id as string, goodsId: snapshot.goodsId as string, contentRevision: snapshot.contentRevision, purpose: 'AUDIT_SUBMISSION', schemaHash: snapshot.schemaHash as string, createdAt: snapshot.createdAt as string },
  }
}

function segment(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/u.test(value)) throw new Error('商品标识格式错误')
  return encodeURIComponent(value)
}

export function createRestoredOperationKey(kind: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `client-goods-${kind}-${suffix}`.slice(0, 100)
}

type RestoredGoodsDraftWriter = Pick<ReturnType<typeof createRestoredGoodsApi>, 'createDraft' | 'updateDraft'>

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value)
}

export function restoredGoodsContentFingerprint(input: RestoredCreateGoodsDraftInput): string {
  const { reason: _operationReason, ...content } = input
  return canonical(content)
}

/** Keeps the successfully persisted draft after a later audit failure. Repeating the
 * same payload returns that draft instead of creating/updating it a second time. */
export function createRestoredGoodsPersistence(api: RestoredGoodsDraftWriter, initial: RestoredOwnedGoods | null = null) {
  let current = initial
  let savedPayload: string | null = null
  let unresolvedCreate: { fingerprint: string; key: string } | null = null
  return {
    getCurrent: () => current,
    reset(goods: RestoredOwnedGoods | null) { current = goods; savedPayload = null; unresolvedCreate = null },
    async save(input: RestoredCreateGoodsDraftInput, key: string, signal?: AbortSignal): Promise<RestoredOwnedGoods> {
      const fingerprint = restoredGoodsContentFingerprint(input)
      if (current && savedPayload === fingerprint) return current
      if (unresolvedCreate && unresolvedCreate.fingerprint !== fingerprint) {
        throw new Error('上次创建结果未知，请先使用原始内容恢复创建结果，确认商品 ID 后再修改')
      }
      const operationKey = unresolvedCreate?.key ?? key
      try {
        current = current
          ? await api.updateDraft(current.id, {
            rowVersion: current.rowVersion, contentRevision: current.contentRevision,
            title: input.title, description: input.description, priceFen: input.priceFen, coverMediaId: input.coverMediaId,
            imageMediaIds: input.imageMediaIds, highlightTags: input.highlightTags, servicePromiseTags: input.servicePromiseTags,
            publishRevisionId: input.publishRevisionId, configVersionId: input.configVersionId, fields: input.fields, reason: input.reason,
          }, operationKey, signal)
          : await api.createDraft(input, operationKey, signal)
      } catch (error) {
        if (!current && error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
          unresolvedCreate = { fingerprint, key: operationKey }
        }
        throw error
      }
      unresolvedCreate = null
      savedPayload = fingerprint
      return current
    },
  }
}

export function createRestoredGoodsApi(transport: Transport) {
  return {
    async listAll(signal?: AbortSignal): Promise<RestoredOwnedGoods[]> {
      return collectRestoredPages(
        (page, pageSignal) => transport.read(`/client/goods?page=${page}&pageSize=50`, parseOwnedGoodsArray, pageSignal),
        item => item.id,
        signal,
      )
    },
    async listGames(signal?: AbortSignal): Promise<RestoredPublicGame[]> {
      return collectRestoredPages(
        (page, pageSignal) => transport.read(`/client/catalog/games?page=${page}&pageSize=50`, parsePublicGames, pageSignal),
        game => game.id,
        signal,
      )
    },
    async read(goodsId: string, signal?: AbortSignal): Promise<RestoredOwnedGoods> {
      return (await transport.read(`/client/goods/${segment(goodsId)}`, parseRestoredOwnedGoods, signal)).data
    },
    async readPublishForm(gameCode: string, signal?: AbortSignal): Promise<RestoredPublishForm> {
      if (!/^[A-Za-z0-9_-]{1,40}$/u.test(gameCode)) throw new Error('游戏标识格式错误')
      const [directory, published] = await Promise.all([
        transport.read(`/client/goods/config/${encodeURIComponent(gameCode)}`, parseRestoredPublishDirectory, signal),
        transport.readPublishedGameConfig(gameCode, parseRestoredPublicPublishConfig, signal),
      ])
      return buildRestoredPublishForm(directory.data, published.data)
    },
    async createDraft(input: RestoredCreateGoodsDraftInput, key: string, signal?: AbortSignal): Promise<RestoredOwnedGoods> {
      return (await transport.write('/client/goods', input, key, parseRestoredOwnedGoods, signal)).data
    },
    async updateDraft(goodsId: string, input: RestoredPatchGoodsDraftInput, key: string, signal?: AbortSignal): Promise<RestoredOwnedGoods> {
      return (await transport.write(`/client/goods/${segment(goodsId)}/draft`, input, key, parseRestoredOwnedGoods, signal)).data
    },
    async submit(goodsId: string, input: { rowVersion: number; contentRevision: number; reason: string }, key: string, signal?: AbortSignal): Promise<RestoredGoodsAuditSubmission> {
      return (await transport.write(`/client/goods/${segment(goodsId)}/audit-submissions`, input, key, parseAuditSubmission, signal)).data
    },
    async offShelf(goodsId: string, input: { rowVersion: number; reason: string }, key: string, signal?: AbortSignal): Promise<RestoredOwnedGoods> {
      return (await transport.write(`/client/goods/${segment(goodsId)}/off-shelf`, input, key, parseRestoredOwnedGoods, signal)).data
    },
  }
}
