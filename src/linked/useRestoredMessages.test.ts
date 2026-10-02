import { afterEach, describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import type { RestoredImConversation, RestoredImMessage, RestoredImMessagesPage } from './restoredImApi'
import { createRestoredConversationController, createRestoredMessagesController } from './useRestoredMessages'

const conversation = (id = 'conversation-1', overrides: Partial<RestoredImConversation> = {}): RestoredImConversation => ({
  id, type: 'TRADE_GROUP', status: 'ACTIVE', title: '交易群', myRole: 'BUYER', unreadCount: 1, lastReadSequence: 0, lastSequence: 1,
  canSend: true, sendDisabledReason: null,
  association: { kind: 'TRADE', orderId: 'order-1', orderNo: 'NO-1', fulfillment: { id: 'fulfill-1', status: 'RUNNING' } },
  lastMessage: { sequence: 1, type: 'TEXT', summary: '客服消息', createdAt: '2026-09-24T01:00:00.000Z' }, updatedAt: '2026-09-24T01:00:00.000Z', ...overrides,
})
const message = (sequence: number, overrides: Partial<RestoredImMessage> = {}): RestoredImMessage => ({
  id: `message-${sequence}`, conversationId: 'conversation-1', sequence, type: 'TEXT', senderRole: 'SERVICE', senderName: '客服', isMine: false,
  content: `消息 ${sequence}`, unsupportedReason: null, createdAt: '2026-09-24T01:00:00.000Z', clientMessageId: null, ...overrides,
})
const page = (messages: RestoredImMessage[], hasMore = false, nextBeforeSequence: number | null = null): RestoredImMessagesPage => ({ messages, hasMore, nextBeforeSequence })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail }); return { promise, resolve, reject } }
afterEach(() => vi.useRealTimers())

describe('restored message controllers', () => {
  it('polls visible lists at 5 seconds, retains stale data, and backs off at 5/10/20/30 seconds', async () => {
    vi.useFakeTimers()
    const listAll = vi.fn()
      .mockResolvedValueOnce([conversation()])
      .mockRejectedValueOnce(new Error('断网 1'))
      .mockRejectedValueOnce(new Error('断网 2'))
      .mockRejectedValueOnce(new Error('断网 3'))
      .mockRejectedValueOnce(new Error('断网 4'))
      .mockResolvedValueOnce([conversation('conversation-2')])
    const controller = createRestoredMessagesController({} as never, { api: { listAll } as never })
    await controller.start()
    expect(controller.getSnapshot().conversations).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(controller.getSnapshot().error).toMatch(/过期.*断网 1/)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(20_000)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(controller.getSnapshot()).toMatchObject({ conversations: [expect.objectContaining({ id: 'conversation-2' })], error: null })
    controller.stop()
  })

  it('pauses while hidden, refreshes immediately when visible, and ignores late requests after stop or replacement', async () => {
    vi.useFakeTimers()
    const late = deferred<RestoredImConversation[]>()
    const listAll = vi.fn().mockImplementationOnce(() => late.promise).mockResolvedValueOnce([conversation('new')]).mockResolvedValue([conversation('visible')])
    const controller = createRestoredMessagesController({} as never, { api: { listAll } as never })
    const starting = controller.start()
    await controller.refresh()
    late.resolve([conversation('old')])
    await starting
    expect(controller.getSnapshot().conversations[0]?.id).toBe('new')
    await controller.setVisible(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(listAll).toHaveBeenCalledTimes(2)
    await controller.setVisible(true)
    expect(controller.getSnapshot().conversations[0]?.id).toBe('visible')
    controller.stop()
  })

  it('loads more than thirty messages explicitly, marks only the maximum displayed sequence read, and rejects repeated cursors', async () => {
    const readMessages = vi.fn()
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 1)), false, null))
    const markRead = vi.fn().mockImplementation(async (_id, sequence) => conversation('conversation-1', { lastReadSequence: sequence, unreadCount: 0, lastSequence: 60 }))
    const api = { readConversation: vi.fn().mockResolvedValue(conversation('conversation-1', { lastSequence: 60 })), readMessages, markRead }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never, createOperationId: () => 'stable-read-operation' })
    await controller.start()
    expect(markRead).toHaveBeenLastCalledWith('conversation-1', 60, 'stable-read-operation', expect.any(AbortSignal))
    await controller.loadEarlier()
    expect(controller.getSnapshot().messages).toHaveLength(60)
    expect(controller.getSnapshot().hasMore).toBe(false)
    controller.stop()

    const repeatedApi = { ...api, readMessages: vi.fn().mockResolvedValue(page([message(1)], true, 31)) }
    const repeated = createRestoredConversationController({} as never, 'conversation-1', { api: repeatedApi as never })
    await repeated.start()
    await expect(repeated.loadEarlier()).resolves.toBeUndefined()
    expect(repeated.getSnapshot().error).toMatch(/cursor|分页|过期/i)
    repeated.stop()
  })

  it('does not mark read while hidden and refreshes plus marks the returned maximum on visibility restore', async () => {
    const readMessages = vi.fn().mockResolvedValueOnce(page([message(1)])).mockResolvedValueOnce(page([message(1), message(2)]))
    const markRead = vi.fn().mockResolvedValue(conversation('conversation-1', { unreadCount: 0, lastReadSequence: 2, lastSequence: 2 }))
    const api = { readConversation: vi.fn().mockResolvedValue(conversation()), readMessages, markRead }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never, createOperationId: () => 'read-visible-key' })
    await controller.setVisible(false)
    await controller.start()
    expect(readMessages).not.toHaveBeenCalled()
    expect(markRead).not.toHaveBeenCalled()
    await controller.setVisible(true)
    expect(markRead).toHaveBeenCalledWith('conversation-1', 1, 'read-visible-key', expect.any(AbortSignal))
    controller.stop()
  })

  it('bridges more than thirty newly arrived messages without sequence holes and preserves completed history', async () => {
    const readMessages = vi.fn()
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 1)), false, null))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 41)), true, 41))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 11)), true, 11))
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation('conversation-1', { lastSequence: 70 })),
      readMessages,
      markRead: vi.fn().mockImplementation(async (_id, sequence) => conversation('conversation-1', { lastReadSequence: sequence, lastSequence: 70, unreadCount: 0 })),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never })
    await controller.start()
    await controller.refresh()
    expect(readMessages.mock.calls.map(call => call[1])).toEqual([undefined, undefined, 41])
    expect(controller.getSnapshot().messages.map(item => item.sequence)).toEqual(Array.from({ length: 70 }, (_, index) => index + 1))
    expect(controller.getSnapshot().hasMore).toBe(false)
    controller.stop()
  })

  it('keeps an earlier page that completes while a latest refresh is still in flight', async () => {
    const latest = deferred<RestoredImMessagesPage>()
    const readMessages = vi.fn()
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
      .mockImplementationOnce(() => latest.promise)
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 1)), false, null))
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation('conversation-1', { lastSequence: 60 })),
      readMessages,
      markRead: vi.fn().mockResolvedValue(conversation('conversation-1', { lastReadSequence: 60, lastSequence: 60, unreadCount: 0 })),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never })
    await controller.start()
    const refreshing = controller.refresh()
    await controller.loadEarlier()
    expect(controller.getSnapshot()).toMatchObject({ messages: expect.arrayContaining([expect.objectContaining({ sequence: 1 })]), hasMore: false })
    latest.resolve(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
    await refreshing
    expect(controller.getSnapshot().messages.map(item => item.sequence)).toEqual(Array.from({ length: 60 }, (_, index) => index + 1))
    expect(controller.getSnapshot().hasMore).toBe(false)
    controller.stop()
  })

  it('keeps ordinary trade polling on the latest range instead of rescanning loaded history', async () => {
    const readMessages = vi.fn()
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 1)), false, null))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation('conversation-1', { lastSequence: 60 })),
      readMessages,
      markRead: vi.fn().mockResolvedValue(conversation('conversation-1', { lastReadSequence: 60, lastSequence: 60, unreadCount: 0 })),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never })
    await controller.start()
    await controller.loadEarlier()
    await controller.refresh()
    expect(readMessages.mock.calls.map(call => call[1])).toEqual([undefined, 31, undefined])
    controller.stop()
  })

  it('revalidates every loaded history page so a read-time safety overlay replaces an old summary', async () => {
    const revokedSummary = '该资料已因安全原因停用，请重新填写'
    const readMessages = vi.fn()
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 1)), false, null))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 1, index === 0 ? { content: revokedSummary } : {})), false, null))
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation('conversation-1', { type: 'RECYCLE_CONSULTATION', association: { kind: 'RECYCLE', consultationId: 'consult-1', recyclerId: 'shop-1', recycleOrderId: null, recycleOrderStatus: null }, lastSequence: 60 })),
      readMessages,
      markRead: vi.fn().mockResolvedValue(conversation('conversation-1', { type: 'RECYCLE_CONSULTATION', association: { kind: 'RECYCLE', consultationId: 'consult-1', recyclerId: 'shop-1', recycleOrderId: null, recycleOrderStatus: null }, lastReadSequence: 60, lastSequence: 60, unreadCount: 0 })),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never })
    await controller.start()
    await controller.loadEarlier()
    expect(controller.getSnapshot().messages.find(item => item.sequence === 1)?.content).toBe('消息 1')

    await controller.refresh()

    expect(readMessages.mock.calls.map(call => call[1])).toEqual([undefined, 31, undefined, 31])
    expect(controller.getSnapshot().messages).toHaveLength(60)
    expect(controller.getSnapshot().messages.find(item => item.sequence === 1)?.content).toBe(revokedSummary)
    controller.stop()
  })

  it('keeps one clientMessageId through UNKNOWN lookup and explicit retry, prevents duplicates, then refreshes immediately', async () => {
    const sendText = vi.fn().mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '结果未知', 'UNKNOWN')).mockResolvedValueOnce(message(2, { isMine: true, senderRole: 'BUYER', clientMessageId: 'stable-message-operation' }))
    const findByClientMessageId = vi.fn().mockRejectedValue(new RestoredHttpError(404, 'CLIENT_IM_MESSAGE_NOT_FOUND', '未找到'))
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation()),
      readMessages: vi.fn().mockResolvedValue(page([message(1)])),
      markRead: vi.fn().mockResolvedValue(conversation()), sendText, findByClientMessageId,
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never, createOperationId: () => 'stable-message-operation' })
    await controller.start()
    await controller.send('请更新进度')
    expect(controller.getSnapshot().sendState).toBe('unknown')
    expect(findByClientMessageId).toHaveBeenCalledWith('conversation-1', 'stable-message-operation', expect.any(AbortSignal))
    await controller.send('请更新进度')
    expect(sendText).toHaveBeenCalledTimes(1)
    await controller.retryUnknown()
    expect(sendText).toHaveBeenNthCalledWith(2, 'conversation-1', '请更新进度', 'stable-message-operation', expect.any(AbortSignal))
    expect(api.readConversation).toHaveBeenCalledTimes(2)
    expect(controller.getSnapshot().sendState).toBe('idle')
    controller.stop()
  })

  it('queries the original key before an explicit unknown retry and does not resend when lookup succeeds or fails', async () => {
    const sendText = vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '结果未知', 'UNKNOWN'))
    const findByClientMessageId = vi.fn()
      .mockRejectedValueOnce(new RestoredHttpError(404, 'CLIENT_IM_MESSAGE_NOT_FOUND', '未找到'))
      .mockResolvedValueOnce(message(2, { isMine: true, senderRole: 'BUYER', clientMessageId: 'lookup-first-operation', content: '查询后恢复' }))
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation()), readMessages: vi.fn().mockResolvedValue(page([message(1)])),
      markRead: vi.fn().mockResolvedValue(conversation()), sendText, findByClientMessageId,
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never, createOperationId: () => 'lookup-first-operation' })
    await controller.start()
    await controller.send('查询后恢复')
    await controller.retryUnknown()
    expect(findByClientMessageId).toHaveBeenCalledTimes(2)
    expect(sendText).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().sendState).toBe('idle')
    controller.stop()

    const lookupFailed = vi.fn()
      .mockRejectedValueOnce(new RestoredHttpError(404, 'CLIENT_IM_MESSAGE_NOT_FOUND', '未找到'))
      .mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '查询断网', 'UNKNOWN'))
    const failedApi = { ...api, sendText: vi.fn().mockRejectedValue(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '结果未知', 'UNKNOWN')), findByClientMessageId: lookupFailed }
    const failed = createRestoredConversationController({} as never, 'conversation-1', { api: failedApi as never, createOperationId: () => 'lookup-failed-operation' })
    await failed.start()
    await failed.send('查询失败不重发')
    await failed.retryUnknown()
    expect(failedApi.sendText).toHaveBeenCalledTimes(1)
    expect(failed.getSnapshot()).toMatchObject({ sendState: 'unknown', sendError: expect.stringMatching(/查询.*失败|查询断网/) })
    failed.stop()
  })

  it('ignores a second send while the first request is unresolved', async () => {
    const pending = deferred<RestoredImMessage>()
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation()), readMessages: vi.fn().mockResolvedValue(page([message(1)])),
      markRead: vi.fn().mockResolvedValue(conversation()), sendText: vi.fn(() => pending.promise), findByClientMessageId: vi.fn(),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never, createOperationId: () => 'single-send-operation' })
    await controller.start()
    const first = controller.send('只发送一次')
    await controller.send('只发送一次')
    expect(api.sendText).toHaveBeenCalledTimes(1)
    pending.resolve(message(2, { senderRole: 'BUYER', isMine: true, clientMessageId: 'single-send-operation', content: '只发送一次' }))
    await first
    controller.stop()
  })

  it.each([
    [401, 'SESSION_EXPIRED'],
    [403, 'FORBIDDEN'],
    [404, 'CLIENT_IM_CONVERSATION_NOT_FOUND'],
    [409, 'RECYCLE_PROFILE_REVOKED'],
    [409, 'RECYCLE_CONSULTATION_RELATION_INVALID'],
  ])('clears retained conversation data after an explicit access failure (%i %s)', async (status, code) => {
    const accessFailure = new RestoredHttpError(status, code, '当前会话已不可访问')
    const api = {
      readConversation: vi.fn().mockResolvedValueOnce(conversation()).mockRejectedValueOnce(accessFailure),
      readMessages: vi.fn().mockResolvedValueOnce(page([message(1)])).mockResolvedValueOnce(page([message(1)])),
      markRead: vi.fn().mockResolvedValue(conversation()),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never })
    await controller.start()
    expect(controller.getSnapshot().messages).toHaveLength(1)
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ conversation: null, messages: [], loading: false, hasMore: false, sendState: 'idle', error: '当前会话已不可访问' })
    controller.stop()
  })

  it.each([
    new RestoredHttpError(409, 'DATA_VERSION_CONFLICT', '版本冲突'),
    new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络不可用'),
  ])('retains loaded conversation data as stale for a non-access read failure', async (readFailure) => {
    const api = {
      readConversation: vi.fn().mockResolvedValueOnce(conversation()).mockRejectedValueOnce(readFailure),
      readMessages: vi.fn().mockResolvedValue(page([message(1)])),
      markRead: vi.fn().mockResolvedValue(conversation()),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never })
    await controller.start()
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({
      conversation: expect.objectContaining({ id: 'conversation-1' }),
      messages: [expect.objectContaining({ id: 'message-1' })],
      error: expect.stringMatching(/可能已过期/),
    })
    controller.stop()
  })

  it('does not let an earlier message refresh revive a snapshot after explicit revocation', async () => {
    const lateConversation = deferred<RestoredImConversation>()
    const latePage = deferred<RestoredImMessagesPage>()
    const api = {
      readConversation: vi.fn()
        .mockResolvedValueOnce(conversation())
        .mockImplementationOnce(() => lateConversation.promise)
        .mockRejectedValueOnce(new RestoredHttpError(409, 'RECYCLE_PROFILE_REVOKED', '资料已停用')),
      readMessages: vi.fn()
        .mockResolvedValueOnce(page([message(1)]))
        .mockImplementationOnce(() => latePage.promise)
        .mockResolvedValueOnce(page([message(1)])),
      markRead: vi.fn().mockResolvedValue(conversation()),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never })
    await controller.start()
    const lateRefresh = controller.refresh()
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ conversation: null, messages: [], error: '资料已停用' })
    lateConversation.resolve(conversation('conversation-1', { title: '迟到的旧会话' }))
    latePage.resolve(page([message(1, { content: '迟到的旧资料' })]))
    await lateRefresh
    expect(controller.getSnapshot()).toMatchObject({ conversation: null, messages: [], error: '资料已停用' })
    controller.stop()
  })

  it('clears cached conversation previews after an explicit list access failure but retains them on network errors', async () => {
    const revokedApi = {
      listAll: vi.fn()
        .mockResolvedValueOnce([conversation('recycle-conversation', { type: 'RECYCLE_CONSULTATION' })])
        .mockRejectedValueOnce(new RestoredHttpError(409, 'RECYCLE_CONSULTATION_RELATION_INVALID', '关联已失效')),
    }
    const revoked = createRestoredMessagesController({} as never, { api: revokedApi as never })
    await revoked.start()
    await revoked.refresh()
    expect(revoked.getSnapshot()).toMatchObject({ conversations: [], loading: false, error: '关联已失效' })
    revoked.stop()

    const networkApi = {
      listAll: vi.fn().mockResolvedValueOnce([conversation('recycle-conversation', { type: 'RECYCLE_CONSULTATION' })]).mockRejectedValueOnce(new Error('断网')),
    }
    const network = createRestoredMessagesController({} as never, { api: networkApi as never })
    await network.start()
    await network.refresh()
    expect(network.getSnapshot()).toMatchObject({
      conversations: [expect.objectContaining({ id: 'recycle-conversation' })],
      error: expect.stringMatching(/可能已过期/),
    })
    network.stop()
  })

  it('cancels pagination and send work at a visibility/lifecycle boundary so late results cannot revive state', async () => {
    const earlier = deferred<RestoredImMessagesPage>()
    const sending = deferred<RestoredImMessage>()
    const readMessages = vi.fn()
      .mockResolvedValueOnce(page(Array.from({ length: 30 }, (_, index) => message(index + 31)), true, 31))
      .mockImplementationOnce(() => earlier.promise)
      .mockResolvedValue(page([message(60)]))
    const api = {
      readConversation: vi.fn().mockResolvedValue(conversation('conversation-1', { lastSequence: 60 })), readMessages,
      markRead: vi.fn().mockResolvedValue(conversation('conversation-1', { lastReadSequence: 60, lastSequence: 60, unreadCount: 0 })),
      sendText: vi.fn(() => sending.promise), findByClientMessageId: vi.fn(),
    }
    const controller = createRestoredConversationController({} as never, 'conversation-1', { api: api as never, createOperationId: () => 'lifecycle-operation' })
    await controller.start()
    const loadingEarlier = controller.loadEarlier()
    await controller.setVisible(false)
    earlier.resolve(page(Array.from({ length: 30 }, (_, index) => message(index + 1)), false, null))
    await loadingEarlier
    expect(controller.getSnapshot().messages).toHaveLength(30)
    expect(controller.getSnapshot().loadingEarlier).toBe(false)
    await controller.setVisible(true)
    const send = controller.send('不能被迟到结果恢复')
    controller.stop()
    await controller.start()
    sending.resolve(message(61, { isMine: true, senderRole: 'BUYER', clientMessageId: 'lifecycle-operation' }))
    await send
    expect(controller.getSnapshot().messages.some(item => item.sequence === 61)).toBe(false)
    expect(controller.getSnapshot().sendState).toBe('idle')
    controller.stop()
  })

  it('clears an old identity snapshot and aborts late data when a new controller owns a new transport', async () => {
    const oldResult = deferred<RestoredImConversation[]>()
    const oldController = createRestoredMessagesController({ identity: 'old' } as never, { api: { listAll: () => oldResult.promise } as never })
    const oldStart = oldController.start()
    oldController.stop()
    const nextController = createRestoredMessagesController({ identity: 'new' } as never, { api: { listAll: vi.fn().mockResolvedValue([conversation('new-identity')]) } as never })
    await nextController.start()
    oldResult.resolve([conversation('old-identity')])
    await oldStart
    expect(nextController.getSnapshot().conversations[0]?.id).toBe('new-identity')
    expect(oldController.getSnapshot().conversations).toEqual([])
    nextController.stop()
  })
})
