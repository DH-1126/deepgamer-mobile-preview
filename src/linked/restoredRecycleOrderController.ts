import { RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'
import { createRestoredRecycleOrderApi, type RestoredRecycleOrder, type RestoredRecycleOrderApi } from './restoredRecycleOrderApi'

/**
 * W04-B：会话内回收单操作状态机（按角色渲染的订单区块）。
 *
 * 恢复模型与回收命令持久化不同：动作经 runAtomicClientWrite 幂等日志落库，
 * UNKNOWN 后同键重发即重放服务端记录；硬刷新后 GET 订单直接呈现真实状态，
 * expectedStatus 保证旧状态上的重复动作安全 409，因此无需本地命令持久化。
 */

export type RestoredRecycleOrderIdentity = { managementId: string; recyclerId: string | null }
export type RestoredRecycleOrderSnapshot = {
  loading: boolean
  stale: boolean
  error: string | null
  order: RestoredRecycleOrder | null
  /** 凭 association 的回收商判定：无单时只有该咨询回收商可以报价。 */
  canQuote: boolean
  role: 'seller' | 'recycler' | 'none'
  busy: boolean
  actionState: 'idle' | 'unknown'
  actionError: string | null
  lastAction: 'quote' | 'confirm' | 'reject' | 'pay' | null
}

const initial = (): RestoredRecycleOrderSnapshot => ({ loading: true, stale: false, error: null, order: null, canQuote: false, role: 'none', busy: false, actionState: 'idle', actionError: null, lastAction: null })
const message = (error: unknown) => error instanceof Error && error.message ? error.message : '回收单请求失败'

type Attempt = { run: (signal?: AbortSignal) => Promise<RestoredRecycleOrder>; key: string; label: 'quote' | 'confirm' | 'reject' | 'pay' }

export function createRestoredRecycleOrderController(
  consultationId: string,
  api: RestoredRecycleOrderApi,
  identity: RestoredRecycleOrderIdentity,
  associationRecyclerId: string,
  makeId: () => string = () => globalThis.crypto.randomUUID(),
) {
  let snapshot = initial()
  let active = false
  let generation = 0
  let readRequest: AbortController | undefined
  let actionRequest: AbortController | undefined
  let attempt: Attempt | null = null
  const listeners = new Set<() => void>()
  const publish = (next: RestoredRecycleOrderSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const patch = (value: Partial<RestoredRecycleOrderSnapshot>) => publish({ ...snapshot, ...value })
  const roleOf = (order: RestoredRecycleOrder | null): RestoredRecycleOrderSnapshot['role'] => {
    if (order) {
      if (identity.managementId === order.sellerManagementId) return 'seller'
      if (identity.recyclerId && identity.recyclerId === order.recyclerId) return 'recycler'
      return 'none'
    }
    return identity.recyclerId && identity.recyclerId === associationRecyclerId ? 'recycler' : 'none'
  }
  const apply = (order: RestoredRecycleOrder) => patch({ order, loading: false, stale: false, error: null, role: roleOf(order), canQuote: roleOf(order) === 'recycler' && !order, busy: false, actionState: 'idle', actionError: null, lastAction: null })

  async function refresh() {
    if (!active) return
    // 动作进行中跳过刷新：避免并发把动作结果判定为过期或 busy 悬挂（复核 P3）。
    if (snapshot.busy || snapshot.actionState === 'unknown') return
    const token = ++generation
    readRequest?.abort()
    const request = new AbortController(); readRequest = request
    if (!snapshot.order) patch({ loading: true, error: null, stale: false })
    try {
      const order = await api.readOrder(consultationId, request.signal)
      if (current(token)) { attempt = null; apply(order) }
    } catch (error) {
      if (!current(token)) return
      if (error instanceof RestoredHttpError && error.status === 404) {
        // 尚无回收单是正常态；只有该咨询回收商可以报价。
        attempt = null
        patch({ order: null, loading: false, stale: false, error: null, role: roleOf(null), canQuote: roleOf(null) === 'recycler', busy: false, actionState: 'idle', actionError: null, lastAction: null })
        return
      }
      if (error instanceof RestoredHttpError && [401, 403].includes(error.status)) {
        generation += 1
        patch({ ...initial(), loading: false, error: message(error) })
        return
      }
      patch({ loading: false, stale: Boolean(snapshot.order), error: message(error) })
    } finally { if (readRequest === request) readRequest = undefined }
  }

  function current(token: number) { return active && token === generation }

  async function run(next: Attempt) {
    const token = generation
    actionRequest?.abort()
    const request = new AbortController(); actionRequest = request
    attempt = next
    patch({ busy: true, actionError: null, lastAction: next.label })
    try {
      const order = await next.run(request.signal)
      if (current(token)) { attempt = null; apply(order) }
    } catch (error) {
      if (!current(token)) return
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        patch({ busy: false, actionState: 'unknown', actionError: '操作结果尚未确认，可重试原操作；不会产生第二张回收单。' })
        return
      }
      if (error instanceof RestoredHttpError && [401, 403].includes(error.status)) {
        generation += 1
        patch({ ...initial(), loading: false, error: message(error) })
        return
      }
      patch({ busy: false, actionError: message(error) })
    } finally { if (actionRequest === request) actionRequest = undefined }
  }

  const key = (label: string) => `client-recycle-order-${label}-${makeId()}`.slice(0, 100)

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async start() { if (active) return; active = true; await refresh() },
    refresh,
    async quote(input: { quoteAmountFen: number; loginAccount: string; description?: string }) {
      if (!snapshot.canQuote || snapshot.busy || snapshot.order) return
      // 幂等键在尝试创建时定格：UNKNOWN 后同键重发才能重放服务端日志。
      const attemptKey = key('quote')
      await run({ label: 'quote', key: attemptKey, run: signal => api.createQuote(consultationId, input, attemptKey, signal) })
    },
    async confirm() {
      const order = snapshot.order
      if (!order || snapshot.busy || order.status !== 'active' || roleOf(order) !== 'seller') return
      const attemptKey = key('confirm')
      await run({ label: 'confirm', key: attemptKey, run: signal => api.confirmOrder(consultationId, order.status, attemptKey, signal) })
    },
    async reject(reason: string) {
      const order = snapshot.order
      if (!order || snapshot.busy || order.status !== 'active' || roleOf(order) !== 'seller') return
      const attemptKey = key('reject')
      await run({ label: 'reject', key: attemptKey, run: signal => api.rejectOrder(consultationId, order.status, reason, attemptKey, signal) })
    },
    async pay() {
      const order = snapshot.order
      if (!order || snapshot.busy || order.status !== 'pending_payment' || roleOf(order) !== 'recycler') return
      const attemptKey = key('pay')
      await run({ label: 'pay', key: attemptKey, run: signal => api.payOrder(consultationId, order.status, attemptKey, signal) })
    },
    async retryUnknown() {
      if (!attempt || snapshot.actionState !== 'unknown' || snapshot.busy) return
      await run(attempt)
    },
    stop() {
      active = false; generation += 1
      readRequest?.abort(); actionRequest?.abort()
      readRequest = undefined; actionRequest = undefined
      attempt = null
      publish(initial()); listeners.clear()
    },
  }
}

export type RestoredRecycleOrderController = ReturnType<typeof createRestoredRecycleOrderController>
export type { RestoredRecycleOrder }
export { createRestoredRecycleOrderApi }
