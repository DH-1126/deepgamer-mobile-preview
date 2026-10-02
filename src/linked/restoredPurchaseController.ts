import type { RestoredOwnedOrder } from './restoredOrderApi'
import { RestoredHttpError } from './restoredLinkedTransport'
import type {
  RestoredPaymentContext,
  RestoredPaymentResult,
  RestoredPublicGoods,
  RestoredPurchaseAction,
  RestoredPurchasePackage,
  RestoredPurchaseQuote,
  RestoredSafeOperationStatus,
} from './restoredPurchaseApi'

type Listener = () => void

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function randomId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`.slice(0, 100)
}

export interface RestoredCatalogSnapshot {
  goods: RestoredPublicGoods[]
  loading: boolean
  error: string | null
}

export function createRestoredCatalogController(api: { listPublicGoods(signal?: AbortSignal): Promise<RestoredPublicGoods[]> }) {
  let snapshot: RestoredCatalogSnapshot = { goods: [], loading: false, error: null }
  let active = false, generation = 0
  let pending: AbortController | undefined
  const listeners = new Set<Listener>()
  const publish = (next: RestoredCatalogSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  async function load() {
    if (!active) return
    const token = ++generation
    pending?.abort(); const request = new AbortController(); pending = request
    publish({ ...snapshot, loading: true, error: null })
    try {
      const goods = await api.listPublicGoods(request.signal)
      if (active && token === generation) publish({ goods, loading: false, error: null })
    } catch (error) {
      if (active && token === generation) publish({ ...snapshot, loading: false, error: message(error, '公开商品读取失败，请重试') })
    } finally { if (pending === request) pending = undefined }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener) },
    async start() { if (active) return; active = true; await load() },
    retry: load,
    stop() { active = false; generation += 1; pending?.abort(); pending = undefined; listeners.clear() },
  }
}

export type RestoredCheckoutApi = {
  readPublicGoods(goodsId: string, signal?: AbortSignal): Promise<RestoredPublicGoods>
  createQuote(goodsId: string, packageId: RestoredPurchasePackage, key: string, signal?: AbortSignal): Promise<RestoredPurchaseQuote>
  recoverQuote(quoteId: string, signal?: AbortSignal): Promise<{ quote: RestoredPurchaseQuote; orderId: string | null }>
  createOrder(quoteId: string, key: string, signal?: AbortSignal): Promise<RestoredPurchaseAction>
}

export interface RestoredCheckoutSnapshot {
  goodsId: string
  packageId: RestoredPurchasePackage
  goods: RestoredPublicGoods | null
  quote: RestoredPurchaseQuote | null
  loading: boolean
  submitting: boolean
  createUnknown: boolean
  error: string | null
}

export interface RestoredCheckoutStart {
  goodsId: string
  packageId: RestoredPurchasePackage
  quoteId?: string
  createKey?: string
}

interface CheckoutOptions {
  onQuoteRecovery(quoteId: string, createKey: string): void
  onOrder(orderId: string, quoteId: string): void
  keyFactory?(kind: 'quote' | 'create'): string
}

export function quoteUnavailableReason(quote: RestoredPurchaseQuote | null, now = Date.now()): string | null {
  if (!quote) return '请先获取服务端报价'
  if (!quote.purchasable) {
    if (quote.blockedReason !== 'PRICING_NOT_CONFIGURED') return '当前商品或报价不允许购买'
    return quote.packageSnapshot.packageId === 'STANDARD'
      ? '普通订单买家服务费尚未配置或未审核生效，请联系平台处理'
      : '包赔费率、适用范围与规则版本尚未配置'
  }
  if (!Number.isFinite(Date.parse(quote.expiresAt)) || Date.parse(quote.expiresAt) <= now) return '报价已过期，请重新获取并确认'
  return null
}

export function createRestoredCheckoutController(api: RestoredCheckoutApi, options: CheckoutOptions) {
  const keyFactory = options.keyFactory ?? (kind => randomId(`purchase-${kind}`))
  let snapshot: RestoredCheckoutSnapshot = { goodsId: '', packageId: 'STANDARD', goods: null, quote: null, loading: false, submitting: false, createUnknown: false, error: null }
  let active = false, generation = 0
  let pending: AbortController | undefined
  let writePending: AbortController | undefined
  let createKey: string | null = null
  let authoritativeStart: RestoredCheckoutStart | null = null
  const listeners = new Set<Listener>()
  const publish = (next: RestoredCheckoutSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }

  async function load(nextInput: RestoredCheckoutStart, replaceAuthoritative = true) {
    if (!active) return
    if (replaceAuthoritative) authoritativeStart = { ...nextInput }
    const input = authoritativeStart ? { ...authoritativeStart } : { ...nextInput }
    const token = ++generation
    pending?.abort(); const request = new AbortController(); pending = request
    createKey = input.quoteId && input.createKey && /^[\x21-\x7e]{8,100}$/u.test(input.createKey) ? input.createKey : null
    publish({ goodsId: input.goodsId, packageId: input.packageId, goods: null, quote: null, loading: true, submitting: false, createUnknown: false, error: null })
    try {
      if (input.quoteId) {
        const recovered = await api.recoverQuote(input.quoteId, request.signal)
        if (!active || token !== generation) return
        if (recovered.quote.goodsId !== input.goodsId || recovered.quote.packageSnapshot.packageId !== input.packageId) throw new Error('报价与当前商品或保障方案不匹配')
        createKey ??= keyFactory('create')
        if (!/^[\x21-\x7e]{8,100}$/u.test(createKey)) throw new Error('下单固定键无效')
        authoritativeStart = { goodsId: input.goodsId, packageId: input.packageId, quoteId: recovered.quote.quoteId, createKey }
        options.onQuoteRecovery(recovered.quote.quoteId, createKey)
        if (recovered.orderId) { options.onOrder(recovered.orderId, recovered.quote.quoteId); return }
        const goods = await api.readPublicGoods(input.goodsId, request.signal)
        if (!active || token !== generation) return
        publish({ goodsId: input.goodsId, packageId: input.packageId, goods, quote: recovered.quote, loading: false, submitting: false, createUnknown: false, error: quoteUnavailableReason(recovered.quote) })
        return
      }
      const [goods, quote] = await Promise.all([
        api.readPublicGoods(input.goodsId, request.signal),
        api.createQuote(input.goodsId, input.packageId, keyFactory('quote'), request.signal),
      ])
      if (!active || token !== generation) return
      if (quote.goodsId !== input.goodsId || quote.packageSnapshot.packageId !== input.packageId) throw new Error('报价与当前商品或保障方案不匹配')
      createKey = keyFactory('create')
      if (!/^[\x21-\x7e]{8,100}$/u.test(createKey)) throw new Error('下单固定键无效')
      authoritativeStart = { goodsId: input.goodsId, packageId: input.packageId, quoteId: quote.quoteId, createKey }
      options.onQuoteRecovery(quote.quoteId, createKey)
      publish({ goodsId: input.goodsId, packageId: input.packageId, goods, quote, loading: false, submitting: false, createUnknown: false, error: quoteUnavailableReason(quote) })
    } catch (error) {
      if (active && token === generation) publish({ ...snapshot, loading: false, error: message(error, '购买确认信息读取失败') })
    } finally { if (pending === request) pending = undefined }
  }

  async function recoverCreatedOrder(quoteId: string, goodsId: string, signal?: AbortSignal) {
    const recovered = await api.recoverQuote(quoteId, signal)
    if (recovered.quote.goodsId !== goodsId || recovered.quote.quoteId !== quoteId) throw new Error('原报价恢复结果不匹配')
    return recovered.orderId
  }

  async function submit(retry: boolean) {
    if (!active || snapshot.loading || snapshot.submitting || !snapshot.quote) return
    const unavailable = quoteUnavailableReason(snapshot.quote)
    if (unavailable) { publish({ ...snapshot, error: unavailable }); return }
    if (!createKey) createKey = keyFactory('create')
    if (!/^[\x21-\x7e]{8,100}$/u.test(createKey)) { publish({ ...snapshot, error: '下单固定键无效' }); return }
    const token = generation
    const quoteId = snapshot.quote.quoteId
    const goodsId = snapshot.goodsId
    const originalCreateKey = createKey
    publish({ ...snapshot, submitting: true, error: null })
    const request = new AbortController()
    writePending = request
    try {
      if (retry) {
        const recoveredOrderId = await recoverCreatedOrder(quoteId, goodsId, request.signal)
        if (!active || token !== generation) return
        if (recoveredOrderId) { options.onOrder(recoveredOrderId, quoteId); return }
      }
      const action = await api.createOrder(quoteId, originalCreateKey, request.signal)
      if (!active || token !== generation) return
      if (!action.order.id) throw new Error('下单结果缺少订单标识')
      publish({ ...snapshot, submitting: false, createUnknown: false, error: null })
      options.onOrder(action.order.id, quoteId)
    } catch (error) {
      if (!active || token !== generation) return
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        try {
          const recoveredOrderId = await recoverCreatedOrder(quoteId, goodsId, request.signal)
          if (!active || token !== generation) return
          if (recoveredOrderId) { options.onOrder(recoveredOrderId, quoteId); return }
        } catch (recoveryError) {
          if (!active || token !== generation) return
          publish({ ...snapshot, submitting: false, createUnknown: true, error: `下单结果未知，原报价查询失败：${message(recoveryError, '请重试查询')}` })
          return
        }
        publish({ ...snapshot, submitting: false, createUnknown: true, error: '下单结果未知，已查询原报价但尚未找到订单。只能用原报价和原固定键显式重试。' })
      } else {
        publish({ ...snapshot, submitting: false, error: message(error, '创建订单失败') })
      }
    } finally {
      if (writePending === request) writePending = undefined
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener) },
    async start(input: RestoredCheckoutStart) { if (active) return; active = true; await load(input) },
    async selectPackage(packageId: RestoredPurchasePackage) { if (snapshot.createUnknown || snapshot.submitting || packageId === snapshot.packageId) return; await load({ goodsId: snapshot.goodsId, packageId }) },
    async refreshQuote() { if (!snapshot.createUnknown && !snapshot.submitting) await load({ goodsId: snapshot.goodsId, packageId: snapshot.packageId }) },
    async retryLoad() { if (authoritativeStart) await load(authoritativeStart, false) },
    async submitOrder() { await submit(false) },
    async retryCreate() { if (snapshot.createUnknown) await submit(true) },
    stop() { active = false; generation += 1; pending?.abort(); writePending?.abort(); pending = undefined; writePending = undefined; listeners.clear() },
  }
}

type PaymentApi = {
  readOrder(orderId: string, signal?: AbortSignal): Promise<RestoredOwnedOrder>
  readPaymentContext(orderId: string, signal?: AbortSignal): Promise<RestoredPaymentContext>
  submitPayment(orderId: string, input: { rowVersion: number; operationId: string; simulatedResult: RestoredPaymentResult; simulatedReceiptRef?: string }, key: string, signal?: AbortSignal): Promise<RestoredPurchaseAction>
}

export interface RestoredPaymentRecovery {
  operationId: string
  simulatedResult: RestoredPaymentResult
  rowVersion: number
}

export interface RestoredPaymentSnapshot {
  orderId: string
  order: RestoredOwnedOrder | null
  context: RestoredPaymentContext | null
  pending: RestoredPaymentRecovery | null
  lastOperationStatus: RestoredSafeOperationStatus | null
  loading: boolean
  busy: boolean
  error: string | null
}

interface PaymentOptions {
  onRecovery(recovery: RestoredPaymentRecovery | null): void
  operationFactory?(): string
  onSettled(status: Exclude<RestoredSafeOperationStatus, 'UNKNOWN'>): void
}

async function paymentKey(recovery: RestoredPaymentRecovery) {
  const canonical = JSON.stringify([recovery.operationId, recovery.simulatedResult, recovery.rowVersion])
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return `payment-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export function stableLocalReceipt(operationId: string) {
  return `LOCAL-DEMO-${operationId}`.slice(0, 100)
}

export function paymentBlockedReason(order: RestoredOwnedOrder | null, context: RestoredPaymentContext | null): string | null {
  if (!order || !context) return '支付上下文尚未就绪'
  if (!order.viewRoles.includes('BUYER')) return '只有订单买家可以继续支付'
  if (order.provenance !== 'LOCAL_DEMO') return '历史关系未核验，不允许支付'
  if (order.status !== 'PENDING_PAYMENT') return '当前订单原始状态不允许新付款'
  if (!context.canStartPayment) return context.blockedReason ?? '服务端当前不允许新付款'
  return null
}

export function createRestoredPaymentController(api: PaymentApi, options: PaymentOptions) {
  const operationFactory = options.operationFactory ?? (() => randomId('operation'))
  let snapshot: RestoredPaymentSnapshot = { orderId: '', order: null, context: null, pending: null, lastOperationStatus: null, loading: false, busy: false, error: null }
  let active = false, generation = 0
  let pendingRequest: AbortController | undefined
  let actionRequest: AbortController | undefined
  const listeners = new Set<Listener>()
  const publish = (next: RestoredPaymentSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }

  function settle(status: Exclude<RestoredSafeOperationStatus, 'UNKNOWN'>, operation = snapshot.context?.operation ?? null) {
    if (!active) return false
    const canRetry = status === 'FAILED'
    const nextContext = snapshot.context ? { ...snapshot.context, canStartPayment: canRetry, blockedReason: canRetry ? null : snapshot.context.blockedReason, operation } : null
    publish({ ...snapshot, context: nextContext, pending: null, lastOperationStatus: status, busy: false, error: null })
    options.onRecovery(null)
    options.onSettled(status)
    return true
  }

  function applyRecoveredContext(nextContext: RestoredPaymentContext) {
    if (!active) return false
    const pending = snapshot.pending
    const operation = nextContext.operation
    if (pending && operation?.operationId === pending.operationId && operation.status !== 'UNKNOWN') {
      publish({ ...snapshot, context: nextContext })
      settle(operation.status, operation)
      return true
    }
    publish({ ...snapshot, context: nextContext, lastOperationStatus: operation?.status ?? snapshot.lastOperationStatus })
    return false
  }

  async function load(orderId: string, recovery: RestoredPaymentRecovery | null = null) {
    if (!active) return
    const token = ++generation
    pendingRequest?.abort(); const request = new AbortController(); pendingRequest = request
    publish({ orderId, order: null, context: null, pending: recovery, lastOperationStatus: null, loading: true, busy: false, error: null })
    try {
      const [order, nextContext] = await Promise.all([api.readOrder(orderId, request.signal), api.readPaymentContext(orderId, request.signal)])
      if (!active || token !== generation) return
      if (order.id !== orderId || nextContext.orderId !== orderId) throw new Error('订单与支付上下文标识不匹配')
      publish({ orderId, order, context: nextContext, pending: recovery, lastOperationStatus: nextContext.operation?.status ?? null, loading: false, busy: false, error: null })
      if (recovery && nextContext.operation?.operationId === recovery.operationId && nextContext.operation.status !== 'UNKNOWN') settle(nextContext.operation.status, nextContext.operation)
    } catch (error) {
      if (active && token === generation) publish({ ...snapshot, loading: false, error: message(error, '支付上下文读取失败') })
    } finally { if (pendingRequest === request) pendingRequest = undefined }
  }

  async function checkPending(showMissingError: boolean, token = generation, signal?: AbortSignal) {
    if (!active || !snapshot.pending || snapshot.busy) return false
    const original = snapshot.pending
    try {
      const nextContext = await api.readPaymentContext(snapshot.orderId, signal)
      if (!active || token !== generation) return false
      if (nextContext.orderId !== snapshot.orderId) throw new Error('支付上下文标识不匹配')
      const settled = applyRecoveredContext(nextContext)
      if (!settled && showMissingError && nextContext.operation?.operationId !== original.operationId) {
        publish({ ...snapshot, error: '尚未查到原支付操作结果，不能假定未扣款。' })
      }
      return settled
    } catch (error) {
      if (!active || token !== generation) return false
      publish({ ...snapshot, error: `原支付操作查询失败：${message(error, '请重试')}` })
      return false
    }
  }

  async function submit(recovery: RestoredPaymentRecovery, token = generation, request = new AbortController()) {
    const input = {
      rowVersion: recovery.rowVersion,
      operationId: recovery.operationId,
      simulatedResult: recovery.simulatedResult,
      ...(recovery.simulatedResult === 'SUCCESS' ? { simulatedReceiptRef: stableLocalReceipt(recovery.operationId) } : {}),
    }
    actionRequest = request
    const orderId = snapshot.orderId
    try {
      const key = await paymentKey(recovery)
      if (!active || token !== generation) return
      const action = await api.submitPayment(orderId, input, key, request.signal)
      if (!active || token !== generation) return
      const operation = action.operation
      if (!operation) throw new Error('支付结果缺少原操作状态')
      if (operation.status === 'UNKNOWN') {
        publish({ ...snapshot, pending: recovery, lastOperationStatus: 'UNKNOWN', busy: false, error: '模拟支付结果未知，请先查询原操作，不要新建付款。' })
        return
      }
      settle(operation.status, operation)
    } catch (error) {
      if (!active || token !== generation) return
      if (error instanceof RestoredHttpError && error.outcome === 'UNKNOWN') {
        publish({ ...snapshot, pending: recovery, lastOperationStatus: 'UNKNOWN', busy: false, error: '支付响应丢失，正在查询原操作结果。' })
        await checkPending(true, token, request.signal)
      } else {
        publish({ ...snapshot, busy: false, error: message(error, '本地模拟支付失败') })
      }
    } finally {
      if (actionRequest === request) actionRequest = undefined
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener) },
    async start(orderId: string, recovery: RestoredPaymentRecovery | null = null) { if (active) return; active = true; await load(orderId, recovery) },
    load,
    async refresh() { await load(snapshot.orderId, snapshot.pending) },
    async startPayment(result: RestoredPaymentResult) {
      if (!active || snapshot.loading || snapshot.busy || snapshot.pending) return
      const blocked = paymentBlockedReason(snapshot.order, snapshot.context)
      if (blocked) { publish({ ...snapshot, error: blocked }); return }
      const operationId = operationFactory()
      if (!/^[\x21-\x7e]{8,100}$/u.test(operationId)) { publish({ ...snapshot, error: '支付操作标识无效' }); return }
      const recovery = { operationId, simulatedResult: result, rowVersion: snapshot.context!.rowVersion }
      options.onRecovery(recovery)
      publish({ ...snapshot, pending: recovery, busy: true, error: null })
      await submit(recovery, generation)
    },
    async checkPending() {
      if (!active || !snapshot.pending || snapshot.busy) return
      const token = generation
      const request = new AbortController(); actionRequest = request
      try { await checkPending(true, token, request.signal) } finally { if (actionRequest === request) actionRequest = undefined }
    },
    async retryOriginal() {
      if (!snapshot.pending || snapshot.busy) return
      const original = snapshot.pending
      const token = generation
      const request = new AbortController(); actionRequest = request
      const settled = await checkPending(false, token, request.signal)
      if (!active || token !== generation || settled || !snapshot.pending) { if (actionRequest === request) actionRequest = undefined; return }
      publish({ ...snapshot, pending: original, busy: true, error: null })
      await submit(original, token, request)
    },
    async resolveUnknown(result: Exclude<RestoredPaymentResult, 'UNKNOWN'>) {
      if (!snapshot.pending || snapshot.busy) return
      const token = generation
      const original = snapshot.pending
      const request = new AbortController(); actionRequest = request
      publish({ ...snapshot, busy: true, error: null })
      try {
        const latest = await api.readPaymentContext(snapshot.orderId, request.signal)
        if (!active || token !== generation) return
        const operation = latest.operation
        if (!operation || operation.operationId !== original.operationId) {
          publish({ ...snapshot, context: latest, busy: false, error: '未找到原未决支付操作，不能创建新操作代替。' })
          return
        }
        if (operation.status !== 'UNKNOWN') {
          publish({ ...snapshot, context: latest, busy: false })
          settle(operation.status, operation)
          return
        }
        const recovery = { operationId: operation.operationId, simulatedResult: result, rowVersion: latest.rowVersion }
        options.onRecovery(recovery)
        publish({ ...snapshot, context: latest, pending: recovery, busy: true, error: null })
        await submit(recovery, token, request)
      } catch (error) {
        if (!active || token !== generation) return
        publish({ ...snapshot, busy: false, error: message(error, '解析原支付操作失败') })
      } finally {
        if (actionRequest === request) actionRequest = undefined
      }
    },
    stop() { active = false; generation += 1; pendingRequest?.abort(); actionRequest?.abort(); pendingRequest = undefined; actionRequest = undefined; listeners.clear() },
  }
}
