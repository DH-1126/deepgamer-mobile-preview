import { collectRestoredPages, RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'

type Transport = ReturnType<typeof createRestoredLinkedTransport>
type RecordValue = Record<string, unknown>

export type RestoredImConversationType = 'TRADE_GROUP' | 'PRIVATE_CHAT' | 'RECYCLE_CONSULTATION'
export type RestoredImConversationStatus = 'ACTIVE' | 'CLOSED'
export type RestoredImMemberRole = 'BUYER' | 'SELLER'
export type RestoredImSenderRole = 'BUYER' | 'SELLER' | 'SERVICE' | 'AI' | 'SYSTEM'
export type RestoredImMessageType = 'TEXT' | 'IMAGE' | 'CARD' | 'SYSTEM'
export type RestoredImSendDisabledReason = 'CONVERSATION_CLOSED' | 'FULFILLMENT_TERMINAL' | 'FULFILLMENT_NOT_RUNNING' | 'BUSINESS_RELATION_INCOMPLETE'

export type RestoredImAssociation =
  | { kind: 'TRADE'; orderId: string; orderNo: string; fulfillment: { id: string; status: 'RUNNING' | 'SUSPENDED' | 'COMPLETED' | 'CANCELED' } }
  | { kind: 'RECYCLE'; consultationId: string; recyclerId: string; recycleOrderId: string | null; recycleOrderStatus: string | null }

export interface RestoredImConversation {
  id: string
  type: RestoredImConversationType
  status: RestoredImConversationStatus
  title: string
  myRole: RestoredImMemberRole
  unreadCount: number
  lastReadSequence: number
  lastSequence: number
  canSend: boolean
  sendDisabledReason: RestoredImSendDisabledReason | null
  association: RestoredImAssociation
  lastMessage: { sequence: number; type: RestoredImMessageType; summary: string; createdAt: string } | null
  updatedAt: string
}

export interface RestoredImMessage {
  id: string
  conversationId: string
  sequence: number
  type: RestoredImMessageType
  senderRole: RestoredImSenderRole
  senderName: string
  isMine: boolean
  content: string
  unsupportedReason: 'MEDIA_NOT_AVAILABLE' | 'CARD_CONTENT_NOT_AVAILABLE' | null
  createdAt: string
  clientMessageId: string | null
}

export interface RestoredImMessagesPage {
  messages: RestoredImMessage[]
  hasMore: boolean
  nextBeforeSequence: number | null
}

function invalid(label: string): never {
  throw new RestoredHttpError(0, 'CLIENT_IM_RESPONSE_INVALID', `${label}不符合已确认 IM 契约`)
}

function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function hasOnly(row: RecordValue, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(row).every(key => allowed.has(key)) && keys.every(key => Object.hasOwn(row, key))
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function nullableString(value: unknown): value is string | null {
  return value === null || nonEmptyString(value)
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

function isoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match
  const year = Number(yearText), month = Number(monthText), day = Number(dayText)
  const hour = Number(hourText), minute = Number(minuteText), second = Number(secondText)
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText)
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText)
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    && hour <= 23 && minute <= 59 && second <= 59 && offsetHour <= 23 && offsetMinute <= 59
}

const conversationTypes: RestoredImConversationType[] = ['TRADE_GROUP', 'PRIVATE_CHAT', 'RECYCLE_CONSULTATION']
const conversationStatuses: RestoredImConversationStatus[] = ['ACTIVE', 'CLOSED']
const memberRoles: RestoredImMemberRole[] = ['BUYER', 'SELLER']
const senderRoles: RestoredImSenderRole[] = ['BUYER', 'SELLER', 'SERVICE', 'AI', 'SYSTEM']
const messageTypes: RestoredImMessageType[] = ['TEXT', 'IMAGE', 'CARD', 'SYSTEM']
const disabledReasons: RestoredImSendDisabledReason[] = ['CONVERSATION_CLOSED', 'FULFILLMENT_TERMINAL', 'FULFILLMENT_NOT_RUNNING', 'BUSINESS_RELATION_INCOMPLETE']

function parseAssociation(value: unknown): RestoredImAssociation {
  const row = object(value)
  if (!row || typeof row.kind !== 'string') invalid('会话关联')
  if (row.kind === 'TRADE') {
    if (!hasOnly(row, ['kind', 'orderId', 'orderNo', 'fulfillment'])) invalid('交易关联')
    const fulfillment = object(row.fulfillment)
    if (!fulfillment || !hasOnly(fulfillment, ['id', 'status']) || !nonEmptyString(row.orderId) || !nonEmptyString(row.orderNo)
      || !nonEmptyString(fulfillment.id) || !['RUNNING', 'SUSPENDED', 'COMPLETED', 'CANCELED'].includes(String(fulfillment.status))) invalid('交易关联')
    return {
      kind: 'TRADE', orderId: row.orderId, orderNo: row.orderNo,
      fulfillment: { id: fulfillment.id, status: fulfillment.status as 'RUNNING' | 'SUSPENDED' | 'COMPLETED' | 'CANCELED' },
    } as RestoredImAssociation
  }
  if (row.kind === 'RECYCLE') {
    if (!hasOnly(row, ['kind', 'consultationId', 'recyclerId', 'recycleOrderId', 'recycleOrderStatus'])
      || !nonEmptyString(row.consultationId) || !nonEmptyString(row.recyclerId)
      || !nullableString(row.recycleOrderId) || !nullableString(row.recycleOrderStatus)) invalid('回收关联')
    return { kind: 'RECYCLE', consultationId: row.consultationId, recyclerId: row.recyclerId, recycleOrderId: row.recycleOrderId, recycleOrderStatus: row.recycleOrderStatus }
  }
  return invalid('会话关联')
}

function parseLastMessage(value: unknown): RestoredImConversation['lastMessage'] {
  if (value === null) return null
  const row = object(value)
  if (!row || !hasOnly(row, ['sequence', 'type', 'summary', 'createdAt']) || !positiveInteger(row.sequence)
    || !messageTypes.includes(row.type as RestoredImMessageType) || typeof row.summary !== 'string' || !isoDate(row.createdAt)) invalid('会话最新消息')
  return { sequence: row.sequence, type: row.type as RestoredImMessageType, summary: row.summary, createdAt: row.createdAt }
}

export function parseRestoredImConversation(value: unknown): RestoredImConversation {
  const row = object(value)
  const keys = ['id', 'type', 'status', 'title', 'myRole', 'unreadCount', 'lastReadSequence', 'lastSequence', 'canSend', 'sendDisabledReason', 'association', 'lastMessage', 'updatedAt']
  if (!row || !hasOnly(row, keys) || !nonEmptyString(row.id) || !conversationTypes.includes(row.type as RestoredImConversationType)
    || !conversationStatuses.includes(row.status as RestoredImConversationStatus) || typeof row.title !== 'string'
    || !memberRoles.includes(row.myRole as RestoredImMemberRole) || !nonnegativeInteger(row.unreadCount)
    || !nonnegativeInteger(row.lastReadSequence) || !nonnegativeInteger(row.lastSequence) || row.lastReadSequence > row.lastSequence
    || typeof row.canSend !== 'boolean' || !(row.sendDisabledReason === null || disabledReasons.includes(row.sendDisabledReason as RestoredImSendDisabledReason))
    || row.canSend !== (row.sendDisabledReason === null)
    || row.unreadCount > row.lastSequence - row.lastReadSequence
    || !isoDate(row.updatedAt)) invalid('会话数据')
  const lastMessage = parseLastMessage(row.lastMessage)
  if ((row.lastSequence === 0) !== (lastMessage === null) || (lastMessage && lastMessage.sequence !== row.lastSequence)) invalid('会话最新消息')
  return {
    id: row.id, type: row.type as RestoredImConversationType, status: row.status as RestoredImConversationStatus,
    title: row.title, myRole: row.myRole as RestoredImMemberRole, unreadCount: row.unreadCount,
    lastReadSequence: row.lastReadSequence, lastSequence: row.lastSequence, canSend: row.canSend,
    sendDisabledReason: row.sendDisabledReason as RestoredImSendDisabledReason | null,
    association: parseAssociation(row.association), lastMessage, updatedAt: row.updatedAt,
  }
}

export function parseRestoredImMessage(value: unknown): RestoredImMessage {
  const row = object(value)
  const keys = ['id', 'conversationId', 'sequence', 'type', 'senderRole', 'senderName', 'isMine', 'content', 'unsupportedReason', 'createdAt', 'clientMessageId']
  if (!row || !hasOnly(row, keys) || !nonEmptyString(row.id) || !nonEmptyString(row.conversationId) || !positiveInteger(row.sequence)
    || !messageTypes.includes(row.type as RestoredImMessageType) || !senderRoles.includes(row.senderRole as RestoredImSenderRole)
    || typeof row.senderName !== 'string' || typeof row.isMine !== 'boolean' || typeof row.content !== 'string'
    || !(row.unsupportedReason === null || ['MEDIA_NOT_AVAILABLE', 'CARD_CONTENT_NOT_AVAILABLE'].includes(String(row.unsupportedReason)))
    || !isoDate(row.createdAt) || !(row.clientMessageId === null || nonEmptyString(row.clientMessageId))) invalid('消息数据')
  const memberRole = row.senderRole === 'BUYER' || row.senderRole === 'SELLER'
  const expectedUnsupported = row.type === 'IMAGE' ? 'MEDIA_NOT_AVAILABLE' : row.type === 'CARD' ? 'CARD_CONTENT_NOT_AVAILABLE' : null
  if ((row.isMine && !memberRole) || (!row.isMine && row.clientMessageId !== null) || row.unsupportedReason !== expectedUnsupported) invalid('消息安全摘要')
  return {
    id: row.id, conversationId: row.conversationId, sequence: row.sequence, type: row.type as RestoredImMessageType,
    senderRole: row.senderRole as RestoredImSenderRole, senderName: row.senderName, isMine: row.isMine, content: row.content,
    unsupportedReason: row.unsupportedReason as RestoredImMessage['unsupportedReason'], createdAt: row.createdAt, clientMessageId: row.clientMessageId,
  }
}

function parseConversationArray(value: unknown): RestoredImConversation[] {
  if (!Array.isArray(value)) invalid('会话列表')
  return value.map(parseRestoredImConversation)
}

function parseMessageArray(value: unknown): RestoredImMessage[] {
  if (!Array.isArray(value)) invalid('消息列表')
  return value.map(parseRestoredImMessage)
}

function segment(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/u.test(value)) throw new RestoredHttpError(0, 'CLIENT_IM_PATH_INVALID', `${label}格式错误`)
  return encodeURIComponent(value)
}

function operationId(value: string): string {
  if (!/^[\x21-\x7e]{8,100}$/u.test(value)) throw new RestoredHttpError(0, 'CLIENT_IM_OPERATION_INVALID', '消息操作标识格式错误')
  return value
}

export function createRestoredImOperationId(kind = 'message'): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `client-im-${kind}-${suffix}`.slice(0, 100)
}

export function createRestoredImApi(transport: Transport) {
  return {
    async listAll(signal?: AbortSignal): Promise<RestoredImConversation[]> {
      return collectRestoredPages(
        (page, pageSignal) => transport.read(`/client/im/conversations?page=${page}&pageSize=100`, parseConversationArray, pageSignal),
        row => row.id,
        signal,
      )
    },
    async readConversation(conversationId: string, signal?: AbortSignal): Promise<RestoredImConversation> {
      const requested = segment(conversationId, '会话标识')
      const result = (await transport.read(`/client/im/conversations/${requested}`, parseRestoredImConversation, signal)).data
      if (result.id !== conversationId) invalid('会话详情')
      return result
    },
    async readMessages(conversationId: string, beforeSequence?: number, signal?: AbortSignal): Promise<RestoredImMessagesPage> {
      const requested = segment(conversationId, '会话标识')
      if (beforeSequence !== undefined && !positiveInteger(beforeSequence)) throw new RestoredHttpError(0, 'CLIENT_IM_CURSOR_INVALID', '消息 cursor 格式错误')
      const query = beforeSequence === undefined ? '?limit=30' : `?beforeSequence=${beforeSequence}&limit=30`
      const { data, meta } = await transport.read(`/client/im/conversations/${requested}/messages${query}`, parseMessageArray, signal)
      const hasMore = meta?.hasMore
      const next = meta?.nextBeforeSequence
      if (typeof hasMore !== 'boolean' || !(next === null || positiveInteger(next))) invalid('消息分页')
      if ((hasMore && (next === null || data.length === 0)) || (!hasMore && next !== null)) invalid('消息分页')
      let previous = 0
      for (const item of data) {
        if (item.conversationId !== conversationId || item.sequence <= previous || (previous > 0 && item.sequence !== previous + 1)
          || (beforeSequence !== undefined && item.sequence >= beforeSequence)) invalid('消息分页')
        previous = item.sequence
      }
      if (beforeSequence !== undefined && data.length > 0 && data.at(-1)?.sequence !== beforeSequence - 1) invalid('消息分页')
      if (hasMore && (next !== data[0]?.sequence || (beforeSequence !== undefined && next >= beforeSequence))) invalid('消息 cursor')
      return { messages: data, hasMore, nextBeforeSequence: next as number | null }
    },
    async sendText(conversationId: string, content: string, clientMessageId: string, signal?: AbortSignal): Promise<RestoredImMessage> {
      const path = segment(conversationId, '会话标识')
      const key = operationId(clientMessageId)
      const normalized = content.trim()
      if (!normalized || normalized.length > 2_000) throw new RestoredHttpError(0, 'CLIENT_IM_CONTENT_INVALID', '消息内容必须为 1–2000 个字符')
      const result = (await transport.write(`/client/im/conversations/${path}/messages`, { messageType: 'TEXT', clientMessageId: key, content: normalized }, key, parseRestoredImMessage, signal)).data
      if (result.conversationId !== conversationId || result.type !== 'TEXT' || !result.isMine
        || result.clientMessageId !== clientMessageId || result.content !== normalized) invalid('发送结果')
      return result
    },
    async findByClientMessageId(conversationId: string, clientMessageId: string, signal?: AbortSignal): Promise<RestoredImMessage> {
      const path = segment(conversationId, '会话标识')
      const key = operationId(clientMessageId)
      const result = (await transport.read(`/client/im/conversations/${path}/messages/by-client-id/${encodeURIComponent(key)}`, parseRestoredImMessage, signal)).data
      if (result.conversationId !== conversationId || result.type !== 'TEXT' || !result.isMine || result.clientMessageId !== clientMessageId) invalid('原消息查询结果')
      return result
    },
    async markRead(conversationId: string, lastReadSequence: number, key: string, signal?: AbortSignal): Promise<RestoredImConversation> {
      const path = segment(conversationId, '会话标识')
      if (!nonnegativeInteger(lastReadSequence)) throw new RestoredHttpError(0, 'CLIENT_IM_READ_SEQUENCE_INVALID', '已读序号格式错误')
      const result = (await transport.write(`/client/im/conversations/${path}/read`, { lastReadSequence }, operationId(key), parseRestoredImConversation, signal)).data
      if (result.id !== conversationId) invalid('已读结果')
      return result
    },
  }
}

export type RestoredImApi = ReturnType<typeof createRestoredImApi>
