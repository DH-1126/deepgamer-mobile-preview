import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useRestoredClient } from './RestoredClientProvider'
import { createRestoredImApi, createRestoredImOperationId, type RestoredImApi, type RestoredImConversation, type RestoredImMessage } from './restoredImApi'
import { RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'

type Transport = ReturnType<typeof createRestoredLinkedTransport>
type ListSnapshot = { conversations: RestoredImConversation[]; loading: boolean; error: string | null }
export type RestoredConversationSendState = 'idle' | 'sending' | 'unknown' | 'failed'
export type ConversationSnapshot = {
  conversation: RestoredImConversation | null
  messages: RestoredImMessage[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingEarlier: boolean
  sendState: RestoredConversationSendState
  sendError: string | null
}

const initialList = (): ListSnapshot => ({ conversations: [], loading: true, error: null })
const initialConversation = (): ConversationSnapshot => ({ conversation: null, messages: [], loading: true, error: null, hasMore: false, loadingEarlier: false, sendState: 'idle', sendError: null })
const emptySubscribe = () => () => {}
const emptyList = initialList()
const emptyConversation = initialConversation()
const getEmptyList = () => emptyList
const getEmptyConversation = () => emptyConversation
const delays = [5_000, 10_000, 20_000, 30_000]

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function stale(current: unknown[], error: unknown, fallback: string): string {
  const detail = message(error, fallback)
  return current.length ? `刷新失败，当前显示上次数据（可能已过期）：${detail}` : detail
}

function isRestoredConversationAccessFailure(error: unknown): error is RestoredHttpError {
  if (!(error instanceof RestoredHttpError)) return false
  if ([401, 403, 404].includes(error.status)) return true
  return error.status === 409 && ['RECYCLE_PROFILE_REVOKED', 'RECYCLE_CONSULTATION_RELATION_INVALID'].includes(error.code)
}

function mergeMessages(current: RestoredImMessage[], incoming: RestoredImMessage[]): RestoredImMessage[] {
  const merged = new Map(current.map(item => [item.id, item]))
  for (const item of incoming) merged.set(item.id, item)
  return [...merged.values()].sort((left, right) => left.sequence - right.sequence)
}

const listChangeListeners = new WeakMap<object, Set<() => void>>()
function subscribeToListChanges(transport: Transport, listener: () => void) {
  let listeners = listChangeListeners.get(transport)
  if (!listeners) { listeners = new Set(); listChangeListeners.set(transport, listeners) }
  listeners.add(listener)
  return () => listeners?.delete(listener)
}
function notifyListChanged(transport: Transport) {
  listChangeListeners.get(transport)?.forEach(listener => listener())
}

export function createRestoredMessagesController(transport: Transport, options: { api?: Pick<RestoredImApi, 'listAll'> } = {}) {
  const api = options.api ?? createRestoredImApi(transport)
  const listeners = new Set<() => void>()
  let snapshot = initialList()
  let active = false
  let visible = true
  let generation = 0
  let failures = 0
  let pending: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsubscribeChange: (() => void) | undefined
  const publish = (next: ListSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const clearTimer = () => { clearTimeout(timer); timer = undefined }
  const schedule = (delay: number) => { clearTimer(); if (active && visible) timer = setTimeout(() => { void refresh() }, delay) }
  async function refresh() {
    if (!active || !visible) return
    const current = ++generation
    clearTimer()
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    publish({ conversations: snapshot.conversations, loading: snapshot.conversations.length === 0, error: snapshot.error })
    try {
      const conversations = await api.listAll(controller.signal)
      if (!active || !visible || current !== generation) return
      failures = 0
      publish({ conversations, loading: false, error: null })
      schedule(5_000)
    } catch (error) {
      if (!active || !visible || current !== generation) return
      if (isRestoredConversationAccessFailure(error)) {
        publish({ conversations: [], loading: false, error: error.message || '当前身份无权查看会话列表' })
        return
      }
      publish({ conversations: snapshot.conversations, loading: false, error: stale(snapshot.conversations, error, '会话列表读取失败') })
      failures++
      schedule(delays[Math.min(failures - 1, delays.length - 1)])
    } finally {
      if (current === generation) pending = undefined
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() {
      if (active) return Promise.resolve()
      active = true
      unsubscribeChange = subscribeToListChanges(transport, () => { void refresh() })
      return visible ? refresh() : Promise.resolve()
    },
    refresh,
    setVisible(next: boolean) {
      if (visible === next) return Promise.resolve()
      visible = next
      generation++
      clearTimer()
      pending?.abort(); pending = undefined
      return active && visible ? refresh() : Promise.resolve()
    },
    stop() {
      active = false; generation++; failures = 0; clearTimer(); pending?.abort(); pending = undefined
      unsubscribeChange?.(); unsubscribeChange = undefined
      publish(initialList())
    },
  }
}

export function createRestoredConversationController(transport: Transport, conversationId: string, options: { api?: RestoredImApi; createOperationId?: (kind?: string) => string } = {}) {
  const api = options.api ?? createRestoredImApi(transport)
  const createOperationId = options.createOperationId ?? createRestoredImOperationId
  const listeners = new Set<() => void>()
  let snapshot = initialConversation()
  let active = false
  let visible = true
  let generation = 0
  let lifecycleEpoch = 0
  let failures = 0
  let pending: AbortController | undefined
  const operations = new Set<AbortController>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let unresolved: { content: string; clientMessageId: string } | null = null
  const publish = (next: ConversationSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const clearTimer = () => { clearTimeout(timer); timer = undefined }
  const schedule = (delay: number) => { clearTimer(); if (active && visible) timer = setTimeout(() => { void refresh() }, delay) }
  const abortOperations = () => { operations.forEach(controller => controller.abort()); operations.clear() }
  const clearAccessRevoked = (error: RestoredHttpError) => {
    generation++
    lifecycleEpoch++
    failures = 0
    clearTimer()
    pending?.abort(); pending = undefined
    abortOperations()
    unresolved = null
    publish({ ...initialConversation(), loading: false, error: error.message || '当前身份无权查看该会话' })
  }

  async function readLatestComplete(existing: RestoredImMessage[], revalidateLoadedHistory: boolean, signal: AbortSignal) {
    const latest = await api.readMessages(conversationId, undefined, signal)
    if (existing.length === 0 || latest.messages.length === 0) return latest
    const loadedBoundarySequence = revalidateLoadedHistory
      ? Math.min(...existing.map(item => item.sequence))
      : Math.max(...existing.map(item => item.sequence)) + 1
    let collected = latest.messages
    let cursor = latest.nextBeforeSequence
    let hasMore = latest.hasMore
    const seenCursors = new Set<number>()
    while (Math.min(...collected.map(item => item.sequence)) > loadedBoundarySequence) {
      if (!hasMore || cursor === null || seenCursors.has(cursor)) {
        throw new RestoredHttpError(0, 'CLIENT_IM_MESSAGE_GAP', '轮询消息出现 sequence 缺口，请重新加载')
      }
      seenCursors.add(cursor)
      const older = await api.readMessages(conversationId, cursor, signal)
      collected = mergeMessages(older.messages, collected)
      cursor = older.nextBeforeSequence
      hasMore = older.hasMore
    }
    return { messages: collected, hasMore: latest.hasMore, nextBeforeSequence: latest.nextBeforeSequence }
  }

  async function markDisplayedRead(controller: AbortController) {
    if (!visible || !snapshot.conversation || snapshot.messages.length === 0) return
    const max = Math.max(...snapshot.messages.map(item => item.sequence))
    if (max <= snapshot.conversation.lastReadSequence) return
    const updated = await api.markRead(conversationId, max, createOperationId('read'), controller.signal)
    if (controller.signal.aborted) return
    publish({ ...snapshot, conversation: updated })
  }

  async function refresh() {
    if (!active || !visible) return
    const current = ++generation
    clearTimer(); pending?.abort()
    const controller = new AbortController(); pending = controller
    publish({ ...snapshot, loading: snapshot.conversation === null, error: snapshot.error })
    try {
      const existing = snapshot.messages
      const revalidateLoadedHistory = snapshot.conversation?.type === 'RECYCLE_CONSULTATION'
      const [conversation, page] = await Promise.all([
        api.readConversation(conversationId, controller.signal),
        readLatestComplete(existing, revalidateLoadedHistory, controller.signal),
      ])
      if (!active || !visible || current !== generation) return
      failures = 0
      const currentMessages = snapshot.messages
      publish({ ...snapshot, conversation, messages: mergeMessages(currentMessages, page.messages), loading: false, error: null, hasMore: currentMessages.length ? snapshot.hasMore : page.hasMore })
      await markDisplayedRead(controller)
      if (!active || !visible || current !== generation) return
      schedule(5_000)
    } catch (error) {
      if (!active || !visible || current !== generation) return
      if (isRestoredConversationAccessFailure(error)) {
        clearAccessRevoked(error)
        return
      }
      publish({ ...snapshot, loading: false, error: stale(snapshot.messages, error, '会话读取失败') })
      failures++
      schedule(delays[Math.min(failures - 1, delays.length - 1)])
    } finally {
      if (current === generation) pending = undefined
    }
  }

  async function loadEarlier() {
    const cursor = snapshot.messages[0]?.sequence
    if (!active || !visible || !snapshot.hasMore || !cursor || snapshot.loadingEarlier) return
    const epoch = lifecycleEpoch
    const controller = new AbortController()
    operations.add(controller)
    publish({ ...snapshot, loadingEarlier: true })
    try {
      const page = await api.readMessages(conversationId, cursor, controller.signal)
      if (!active || !visible || epoch !== lifecycleEpoch) return
      if (page.nextBeforeSequence === cursor || page.messages.some(item => snapshot.messages.some(current => current.sequence === item.sequence))) {
        throw new RestoredHttpError(0, 'CLIENT_IM_CURSOR_REPEATED', '消息分页 cursor 重复或已过期，请刷新')
      }
      publish({ ...snapshot, messages: mergeMessages(snapshot.messages, page.messages), hasMore: page.hasMore, loadingEarlier: false, error: null })
    } catch (error) {
      if (!active || !visible || epoch !== lifecycleEpoch) return
      if (isRestoredConversationAccessFailure(error)) {
        clearAccessRevoked(error)
        return
      }
      publish({ ...snapshot, loadingEarlier: false, error: stale(snapshot.messages, error, '更早消息读取失败') })
    } finally {
      operations.delete(controller)
    }
  }

  async function settleSent(result: RestoredImMessage, epoch: number) {
    if (!active || !visible || epoch !== lifecycleEpoch) return
    unresolved = null
    publish({ ...snapshot, messages: mergeMessages(snapshot.messages, [result]), sendState: 'idle', sendError: null })
    await refresh()
    if (!active || !visible || epoch !== lifecycleEpoch) return
    notifyListChanged(transport)
  }

  async function attempt(operation: { content: string; clientMessageId: string }) {
    const epoch = lifecycleEpoch
    const controller = new AbortController()
    operations.add(controller)
    unresolved = operation
    publish({ ...snapshot, sendState: 'sending', sendError: null })
    try {
      const result = await api.sendText(conversationId, operation.content, operation.clientMessageId, controller.signal)
      if (!active || !visible || epoch !== lifecycleEpoch) return
      await settleSent(result, epoch)
    } catch (error) {
      if (!active || !visible || epoch !== lifecycleEpoch) return
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        try {
          const found = await api.findByClientMessageId(conversationId, operation.clientMessageId, controller.signal)
          if (!active || !visible || epoch !== lifecycleEpoch) return
          await settleSent(found, epoch)
          return
        } catch (lookupError) {
          if (!active || !visible || epoch !== lifecycleEpoch) return
          unresolved = operation
          const notFound = lookupError instanceof RestoredHttpError && lookupError.status === 404 && lookupError.code === 'CLIENT_IM_MESSAGE_NOT_FOUND'
          publish({ ...snapshot, sendState: 'unknown', sendError: notFound
            ? '发送结果未知，已查询原操作但暂未找到；如需继续，请重试原操作'
            : `发送结果未知，查询原操作失败：${message(lookupError, '请稍后重试原操作')}` })
          return
        }
      }
      unresolved = null
      publish({ ...snapshot, sendState: 'failed', sendError: message(error, '消息发送失败，请修改后重试') })
    } finally {
      operations.delete(controller)
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() { if (active) return Promise.resolve(); active = true; lifecycleEpoch++; return visible ? refresh() : Promise.resolve() },
    refresh,
    loadEarlier,
    async send(content: string) {
      const normalized = content.trim()
      if (!normalized || snapshot.sendState === 'sending' || snapshot.sendState === 'unknown' || snapshot.error || !snapshot.conversation?.canSend) return
      const operation = { content: normalized, clientMessageId: createOperationId('message') }
      await attempt(operation)
    },
    async retryUnknown() {
      if (!unresolved || snapshot.sendState !== 'unknown') return
      const operation = unresolved
      const epoch = lifecycleEpoch
      const controller = new AbortController()
      operations.add(controller)
      publish({ ...snapshot, sendState: 'sending', sendError: null })
      try {
        const found = await api.findByClientMessageId(conversationId, operation.clientMessageId, controller.signal)
        if (!active || !visible || epoch !== lifecycleEpoch) return
        await settleSent(found, epoch)
      } catch (error) {
        if (!active || !visible || epoch !== lifecycleEpoch) return
        const notFound = error instanceof RestoredHttpError && error.status === 404 && error.code === 'CLIENT_IM_MESSAGE_NOT_FOUND'
        if (notFound) {
          await attempt(operation)
          return
        }
        unresolved = operation
        publish({ ...snapshot, sendState: 'unknown', sendError: `发送结果未知，查询原操作失败：${message(error, '请稍后重试原操作')}` })
      } finally {
        operations.delete(controller)
      }
    },
    setVisible(next: boolean) {
      if (visible === next) return Promise.resolve()
      if (!next && (snapshot.loadingEarlier || snapshot.sendState === 'sending')) {
        publish({
          ...snapshot,
          loadingEarlier: false,
          ...(snapshot.sendState === 'sending' && unresolved
            ? { sendState: 'unknown' as const, sendError: '页面已隐藏，发送结果未知；返回后可查询并重试原操作' }
            : {}),
        })
      }
      visible = next; lifecycleEpoch++; generation++; clearTimer(); pending?.abort(); pending = undefined; abortOperations()
      return active && visible ? refresh() : Promise.resolve()
    },
    stop() {
      active = false; lifecycleEpoch++; generation++; failures = 0; clearTimer(); pending?.abort(); pending = undefined; abortOperations(); unresolved = null
      publish(initialConversation())
    },
  }
}

export function useRestoredMessages() {
  const { transport } = useRestoredClient()
  const controller = useMemo(() => transport ? createRestoredMessagesController(transport) : null, [transport])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? emptySubscribe, controller?.getSnapshot ?? getEmptyList, controller?.getSnapshot ?? getEmptyList)
  useEffect(() => {
    if (!controller) return undefined
    const sync = () => { void controller.setVisible(document.visibilityState === 'visible') }
    void controller.setVisible(document.visibilityState === 'visible'); void controller.start()
    document.addEventListener('visibilitychange', sync)
    return () => { document.removeEventListener('visibilitychange', sync); controller.stop() }
  }, [controller])
  const refresh = useCallback(async () => { await controller?.refresh() }, [controller])
  const unreadCount = snapshot.conversations.reduce((total, item) => total + item.unreadCount, 0)
  return { ...snapshot, unread: unreadCount, unreadCount, refresh }
}

export function useRestoredConversation(conversationId: string) {
  const { transport } = useRestoredClient()
  const controller = useMemo(() => transport && conversationId ? createRestoredConversationController(transport, conversationId) : null, [transport, conversationId])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? emptySubscribe, controller?.getSnapshot ?? getEmptyConversation, controller?.getSnapshot ?? getEmptyConversation)
  useEffect(() => {
    if (!controller) return undefined
    const sync = () => { void controller.setVisible(document.visibilityState === 'visible') }
    void controller.setVisible(document.visibilityState === 'visible'); void controller.start()
    document.addEventListener('visibilitychange', sync)
    return () => { document.removeEventListener('visibilitychange', sync); controller.stop() }
  }, [controller])
  return {
    ...snapshot,
    refresh: useCallback(async () => { await controller?.refresh() }, [controller]),
    loadEarlier: useCallback(async () => { await controller?.loadEarlier() }, [controller]),
    send: useCallback(async (content: string) => { await controller?.send(content) }, [controller]),
    retryUnknown: useCallback(async () => { await controller?.retryUnknown() }, [controller]),
  }
}
