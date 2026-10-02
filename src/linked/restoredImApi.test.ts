import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError, type RestoredEnvelope } from './restoredLinkedTransport'
import {
  createRestoredImApi,
  parseRestoredImConversation,
  parseRestoredImMessage,
  type RestoredImConversation,
} from './restoredImApi'

const conversation = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: 'TRADE_GROUP',
  status: 'ACTIVE',
  title: `会话 ${id}`,
  myRole: 'BUYER',
  unreadCount: 1,
  lastReadSequence: 0,
  lastSequence: 1,
  canSend: true,
  sendDisabledReason: null,
  association: {
    kind: 'TRADE',
    orderId: `order-${id}`,
    orderNo: `NO-${id}`,
    fulfillment: { id: `fulfill-${id}`, status: 'RUNNING' },
  },
  lastMessage: { sequence: 1, type: 'TEXT', summary: '最新消息', createdAt: '2026-09-24T01:00:00.000Z' },
  updatedAt: '2026-09-24T01:00:00.000Z',
  ...overrides,
})

const message = (conversationId: string, sequence: number, overrides: Record<string, unknown> = {}) => ({
  id: `${conversationId}-message-${sequence}`,
  conversationId,
  sequence,
  type: 'TEXT',
  senderRole: 'BUYER',
  senderName: '合成买家',
  isMine: true,
  content: `消息 ${sequence}`,
  unsupportedReason: null,
  createdAt: '2026-09-24T01:00:00.000Z',
  clientMessageId: `client-message-${sequence}`,
  ...overrides,
})

describe('restored member IM API', () => {
  it('strictly preserves trade/recycle associations and server sender roles', () => {
    expect(parseRestoredImConversation(conversation('trade-1')).association).toMatchObject({ kind: 'TRADE', orderId: 'order-trade-1' })
    expect(parseRestoredImConversation(conversation('recycle-1', {
      type: 'RECYCLE_CONSULTATION',
      association: { kind: 'RECYCLE', consultationId: 'consultation-1', recyclerId: 'recycler-1', recycleOrderId: 'recycle-order-1', recycleOrderStatus: 'QUOTED' },
    }))).toMatchObject({ type: 'RECYCLE_CONSULTATION', association: { kind: 'RECYCLE', consultationId: 'consultation-1', recycleOrderId: 'recycle-order-1' } })
    expect(parseRestoredImMessage(message('trade-1', 2, { senderRole: 'SERVICE', senderName: '客服', isMine: false, clientMessageId: null }))).toMatchObject({ senderRole: 'SERVICE', isMine: false })
    expect(() => parseRestoredImConversation(conversation('bad', { type: 'AI_CONSULTATION' }))).toThrow(/IM/)
    expect(() => parseRestoredImMessage({ ...message('trade-1', 3), rawPayload: { private: true } })).toThrow(/IM/)
  })

  it('requires real offset datetimes and coherent conversation counters/capabilities', () => {
    expect(parseRestoredImConversation(conversation('offset', { updatedAt: '2026-09-24T09:00:00+08:00' })).updatedAt).toBe('2026-09-24T09:00:00+08:00')
    expect(parseRestoredImConversation(conversation('suspended', {
      canSend: false,
      sendDisabledReason: 'FULFILLMENT_NOT_RUNNING',
      association: { kind: 'TRADE', orderId: 'order-suspended', orderNo: 'NO-suspended', fulfillment: { id: 'fulfill-suspended', status: 'SUSPENDED' } },
    }))).toMatchObject({ canSend: false, sendDisabledReason: 'FULFILLMENT_NOT_RUNNING', association: { fulfillment: { status: 'SUSPENDED' } } })
    for (const invalid of [
      conversation('no-offset', { updatedAt: '2026-09-24T01:00:00' }),
      conversation('invalid-date', { updatedAt: '2026-02-31T01:00:00.000Z' }),
      conversation('capability', { canSend: true, sendDisabledReason: 'FULFILLMENT_NOT_RUNNING' }),
      conversation('missing-reason', { canSend: false, sendDisabledReason: null }),
      conversation('last-sequence', { lastSequence: 2 }),
      conversation('unread', { unreadCount: 2, lastReadSequence: 0, lastSequence: 1 }),
    ]) expect(() => parseRestoredImConversation(invalid)).toThrow(/IM/)
  })

  it('enforces sender ownership and the fixed unsupported-reason mapping', () => {
    expect(() => parseRestoredImMessage(message('trade-1', 1, { senderRole: 'SERVICE', isMine: true }))).toThrow(/IM/)
    expect(() => parseRestoredImMessage(message('trade-1', 1, { isMine: false, clientMessageId: 'not-mine-key' }))).toThrow(/IM/)
    expect(() => parseRestoredImMessage(message('trade-1', 1, { type: 'TEXT', unsupportedReason: 'MEDIA_NOT_AVAILABLE' }))).toThrow(/IM/)
    expect(() => parseRestoredImMessage(message('trade-1', 1, { type: 'IMAGE', unsupportedReason: null }))).toThrow(/IM/)
    expect(() => parseRestoredImMessage(message('trade-1', 1, { type: 'CARD', unsupportedReason: 'MEDIA_NOT_AVAILABLE' }))).toThrow(/IM/)
    expect(() => parseRestoredImMessage(message('trade-1', 1, { type: 'SYSTEM', unsupportedReason: 'CARD_CONTENT_NOT_AVAILABLE' }))).toThrow(/IM/)
    expect(parseRestoredImMessage(message('trade-1', 1, { type: 'IMAGE', unsupportedReason: 'MEDIA_NOT_AVAILABLE' }))).toMatchObject({ type: 'IMAGE', unsupportedReason: 'MEDIA_NOT_AVAILABLE' })
    expect(parseRestoredImMessage(message('trade-1', 1, { type: 'CARD', unsupportedReason: 'CARD_CONTENT_NOT_AVAILABLE' }))).toMatchObject({ type: 'CARD', unsupportedReason: 'CARD_CONTENT_NOT_AVAILABLE' })
  })

  it('collects every reported conversation page without a fixed fifty-row truncation or administrator endpoint', async () => {
    const paths: string[] = []
    const transport = {
      async read<T>(path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        paths.push(path)
        const page = Number(new URL(`http://test${path}`).searchParams.get('page'))
        const rows = page === 1
          ? Array.from({ length: 50 }, (_, index) => conversation(`conversation-${index + 1}`))
          : Array.from({ length: 5 }, (_, index) => conversation(`conversation-${index + 51}`))
        return { data: parse(rows), meta: { page, pageSize: 50, total: 55 } }
      },
      async write() { throw new Error('unexpected write') },
    }
    const rows = await createRestoredImApi(transport as never).listAll()
    expect(rows).toHaveLength(55)
    expect(rows.at(-1)?.id).toBe('conversation-55')
    expect(paths).toEqual([
      '/client/im/conversations?page=1&pageSize=100',
      '/client/im/conversations?page=2&pageSize=100',
    ])
    expect(paths.every(path => !path.includes('/admin/') && !path.includes('/ops/'))).toBe(true)
  })

  it('rejects repeated, non-monotonic, and cross-conversation message cursors', async () => {
    const responses = [
      { data: [message('conversation-1', 31), message('conversation-1', 32)], meta: { hasMore: true, nextBeforeSequence: 31 } },
      { data: [message('conversation-1', 1)], meta: { hasMore: true, nextBeforeSequence: 31 } },
      { data: [message('conversation-2', 1)], meta: { hasMore: false, nextBeforeSequence: null } },
    ]
    const transport = {
      async read<T>(_path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        const next = responses.shift()!
        return { data: parse(next.data), meta: next.meta }
      },
      async write() { throw new Error('unexpected write') },
    }
    const api = createRestoredImApi(transport as never)
    await expect(api.readMessages('conversation-1')).resolves.toMatchObject({ nextBeforeSequence: 31 })
    await expect(api.readMessages('conversation-1', 31)).rejects.toThrow(/cursor|IM/i)
    await expect(api.readMessages('conversation-1')).rejects.toThrow(/conversation|IM/i)
  })

  it('uses the client-only detail/send/read/by-client-id endpoints and stable operation keys', async () => {
    const calls: Array<{ kind: string; path: string; body?: unknown; key?: string }> = []
    const transport = {
      async read<T>(path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        calls.push({ kind: 'read', path })
        if (path.includes('missing-message')) throw new RestoredHttpError(404, 'CLIENT_IM_MESSAGE_NOT_FOUND', '未找到')
        return { data: parse(path.includes('by-client-id') ? message('conversation-1', 2, { clientMessageId: 'stable-client-message' }) : conversation('conversation-1')) }
      },
      async write<T>(path: string, body: unknown, key: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        calls.push({ kind: 'write', path, body, key })
        const input = body as { clientMessageId?: string; content?: string }
        return { data: parse(path.endsWith('/read') ? conversation('conversation-1', { lastReadSequence: 2, lastSequence: 2, unreadCount: 0, lastMessage: { sequence: 2, type: 'TEXT', summary: '请更新进度', createdAt: '2026-09-24T01:00:00.000Z' } }) : message('conversation-1', 2, { clientMessageId: input.clientMessageId, content: input.content })) }
      },
    }
    const api = createRestoredImApi(transport as never)
    await expect(api.readConversation('conversation-1')).resolves.toMatchObject({ id: 'conversation-1' })
    await expect(api.sendText('conversation-1', '请更新进度', 'stable-client-message')).resolves.toMatchObject({ conversationId: 'conversation-1' })
    await expect(api.findByClientMessageId('conversation-1', 'stable-client-message')).resolves.toMatchObject({ clientMessageId: 'stable-client-message' })
    await expect(api.findByClientMessageId('conversation-1', 'missing-message')).rejects.toMatchObject({ status: 404, code: 'CLIENT_IM_MESSAGE_NOT_FOUND' })
    await expect(api.markRead('conversation-1', 2, 'stable-read-operation')).resolves.toMatchObject({ lastReadSequence: 2 })
    expect(calls).toContainEqual({ kind: 'write', path: '/client/im/conversations/conversation-1/messages', body: { messageType: 'TEXT', clientMessageId: 'stable-client-message', content: '请更新进度' }, key: 'stable-client-message' })
    expect(calls).toContainEqual({ kind: 'write', path: '/client/im/conversations/conversation-1/read', body: { lastReadSequence: 2 }, key: 'stable-read-operation' })
    expect(calls.every(call => !call.path.includes('/admin/') && !call.path.startsWith('/im/'))).toBe(true)
  })

  it('rejects send and lookup responses that are not the caller original TEXT operation', async () => {
    let payload: unknown = message('conversation-1', 2, { content: '被替换', clientMessageId: 'stable-client-message' })
    const transport = {
      async read<T>(_path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> { return { data: parse(payload) } },
      async write<T>(_path: string, _body: unknown, _key: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> { return { data: parse(payload) } },
    }
    const api = createRestoredImApi(transport as never)
    await expect(api.sendText('conversation-1', '原始内容', 'stable-client-message')).rejects.toThrow(/IM/)
    payload = message('conversation-1', 2, { type: 'CARD', content: '卡片', unsupportedReason: 'CARD_CONTENT_NOT_AVAILABLE', isMine: false, senderRole: 'SYSTEM', clientMessageId: null })
    await expect(api.findByClientMessageId('conversation-1', 'stable-client-message')).rejects.toThrow(/IM/)
  })

  it('rejects unsafe path segments and inconsistent conversation details', async () => {
    const transport = {
      async read<T>(_path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        return { data: parse(conversation('server-id')) }
      },
      async write() { throw new Error('unexpected write') },
    }
    const api = createRestoredImApi(transport as never)
    await expect(api.readConversation('../admin')).rejects.toThrow(/格式错误/)
    await expect(api.readConversation('requested-id')).rejects.toThrow(/IM/)
  })
})

export type TestConversation = RestoredImConversation
