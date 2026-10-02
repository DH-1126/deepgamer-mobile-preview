import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import type { RestoredOwnedOrder } from './restoredOrderApi'
import type { RestoredPaymentContext, RestoredPublicGoods, RestoredPurchaseAction, RestoredPurchaseQuote } from './restoredPurchaseApi'
import {
  createRestoredCatalogController,
  createRestoredCheckoutController,
  createRestoredPaymentController,
  type RestoredPaymentRecovery,
} from './restoredPurchaseController'

function goods(id = 'harness-purchase-goods'): RestoredPublicGoods {
  return {
    id, goodsNo: `NO-${id}`, title: '合成外部卖家商品', priceFen: 120_000, currency: 'CNY', description: '本地验收', coverUrl: null, images: [],
    game: { id: 'game-1', code: 'wzry', name: '王者荣耀' }, seller: { sellerRef: 'external-seller', displayName: '合成外部卖家' }, attributes: [],
    contentRevision: 2, rowVersion: 3, snapshotId: 'snapshot-1', schemaHash: 'a'.repeat(64), productStatus: 'ON_SALE', auditStatus: 'APPROVED', locked: false,
    createdAt: '2026-09-28T08:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z',
  }
}

function quote(packageId: 'STANDARD' | 'PREMIUM' = 'STANDARD', overrides: Partial<RestoredPurchaseQuote> = {}): RestoredPurchaseQuote {
  return {
    quoteId: `quote-${packageId.toLowerCase()}`, quoteVersion: 1, expiresAt: '2099-09-28T12:00:00.000Z', goodsId: 'harness-purchase-goods', goodsVersion: 3, currency: 'CNY',
    packageSnapshot: { packageId, label: packageId === 'STANDARD' ? '普通交易' : '包赔保障', pricingVersion: packageId === 'STANDARD' ? 'standard-v1' : null },
    amounts: { goodsAmountFen: 120_000, serviceFeeFen: 8_001, guaranteeFeeFen: 0, discountFen: 1_000, payableAmountFen: 127_001 },
    purchasable: packageId === 'STANDARD', blockedReason: packageId === 'STANDARD' ? null : 'PRICING_NOT_CONFIGURED', ...overrides,
  }
}

function ownedOrder(overrides: Partial<RestoredOwnedOrder> = {}): RestoredOwnedOrder {
  return {
    id: 'order-1', orderNo: 'ORDER-1', status: 'PENDING_PAYMENT', statusLabel: '待付款', rowVersion: 4,
    goods: { goodsNo: 'NO-1', title: '合成外部卖家商品', coverUrl: null, game: { code: 'wzry', name: '王者荣耀', iconUrl: null }, accountMasked: '***123', regionName: '微信区', serverName: '一区' },
    buyer: { userRef: 'buyer-1', displayName: '合成买家' }, seller: { userRef: 'external-seller', displayName: '合成外部卖家' }, viewRoles: ['BUYER'],
    amountFen: 127_001, paidAmountFen: 0, refundedAmountFen: 0, currency: 'CNY',
    payment: { paymentNo: null, paymentChannel: null, goodsAmountFen: 120_000, serviceFeeFen: 8_001, discountFen: 1_000, payableAmountFen: 127_001, paidAmountFen: 0, paidAt: null, refundAmountFen: 0, refundedAt: null },
    afterSaleEntryEnabled: false, createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z', paidAt: null, completedAt: null, cancelledAt: null,
    provenance: 'LOCAL_DEMO', trade: null,
    financials: { provenance: 'LOCAL_DEMO', amounts: { goodsAmountFen: 120_000, serviceFeeFen: 8_001, guaranteeFeeFen: 0, discountFen: 1_000, payableAmountFen: 127_001 }, paidAmountFen: 0, refundedAmountFen: 0, pendingRefundAmountFen: 0 },
    ...overrides,
  }
}

function context(overrides: Partial<RestoredPaymentContext> = {}): RestoredPaymentContext {
  return { orderId: 'order-1', rowVersion: 4, canStartPayment: true, blockedReason: null, operation: null, ...overrides }
}

function action(status: 'UNKNOWN' | 'FAILED' | 'SUCCEEDED' | 'REFUND_REQUIRED', operationId: string, rowVersion = 4): RestoredPurchaseAction {
  return {
    order: { id: 'order-1', status: status === 'SUCCEEDED' ? 'DELIVERING' : status === 'REFUND_REQUIRED' ? 'CANCELLED' : 'PENDING_PAYMENT', rowVersion },
    operation: { operationId, orderId: 'order-1', amountFen: 127_001, currency: 'CNY', status, createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:01.000Z' },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

describe('restored purchase controllers', () => {
  it('blocks STANDARD with missing buyer fee configuration without calling it a guarantee fee or creating an order', async () => {
    const createOrder = vi.fn()
    const controller = createRestoredCheckoutController({
      readPublicGoods: async () => goods(),
      createQuote: async () => quote('STANDARD', { purchasable: false, blockedReason: 'PRICING_NOT_CONFIGURED',
        packageSnapshot: { packageId: 'STANDARD', label: '普通交易', pricingVersion: null } }),
      recoverQuote: vi.fn(), createOrder,
    }, { onQuoteRecovery: vi.fn(), onOrder: vi.fn() })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD' })
    await controller.submitOrder()
    expect(controller.getSnapshot().error).toContain('普通订单买家服务费')
    expect(controller.getSnapshot().error).not.toContain('包赔')
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('loads the complete public catalog and exposes honest empty/error states', async () => {
    const api = { listPublicGoods: vi.fn(async () => [goods()]) }
    const controller = createRestoredCatalogController(api)
    await controller.start()
    expect(controller.getSnapshot()).toMatchObject({ loading: false, error: null, goods: [{ id: 'harness-purchase-goods' }] })
    controller.stop()
  })

  it('ignores an old package quote after the user switches to a newer package', async () => {
    const standard = deferred<RestoredPurchaseQuote>(), premium = deferred<RestoredPurchaseQuote>()
    const api = {
      readPublicGoods: vi.fn(async () => goods()),
      createQuote: vi.fn((_goodsId: string, packageId: 'STANDARD' | 'PREMIUM') => packageId === 'STANDARD' ? standard.promise : premium.promise),
      recoverQuote: vi.fn(), createOrder: vi.fn(),
    }
    const recovered: string[] = []
    const controller = createRestoredCheckoutController(api, { onQuoteRecovery: id => recovered.push(id), onOrder: vi.fn(), keyFactory: kind => `${kind}-fixed-key` })
    const first = controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD' })
    await Promise.resolve()
    const switched = controller.selectPackage('PREMIUM')
    premium.resolve(quote('PREMIUM')); await switched
    standard.resolve(quote('STANDARD')); await first
    expect(controller.getSnapshot()).toMatchObject({ packageId: 'PREMIUM', quote: { quoteId: 'quote-premium', packageSnapshot: { packageId: 'PREMIUM' } } })
    expect(recovered).toEqual(['quote-premium'])
  })

  it('recovers a timed-out create by quote and retries only the original quote/key when still absent', async () => {
    const createOrder = vi.fn()
      .mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '结果未知', 'UNKNOWN'))
      .mockResolvedValueOnce({ order: { id: 'order-1', status: 'PENDING_PAYMENT', rowVersion: 1 }, operation: null })
    const recoverQuote = vi.fn()
      .mockResolvedValueOnce({ quote: quote(), orderId: null })
      .mockResolvedValueOnce({ quote: quote(), orderId: null })
    const onOrder = vi.fn()
    const controller = createRestoredCheckoutController({ readPublicGoods: async () => goods(), createQuote: async () => quote(), recoverQuote, createOrder }, {
      onQuoteRecovery: vi.fn(), onOrder, keyFactory: kind => `${kind}-frozen-key`,
    })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD' })
    await controller.submitOrder()
    expect(controller.getSnapshot()).toMatchObject({ createUnknown: true, quote: { quoteId: 'quote-standard' } })
    expect(onOrder).not.toHaveBeenCalled()
    await controller.retryCreate()
    expect(createOrder.mock.calls).toEqual([['quote-standard', 'create-frozen-key', expect.anything()], ['quote-standard', 'create-frozen-key', expect.anything()]])
    expect(onOrder).toHaveBeenCalledWith('order-1', 'quote-standard')
  })

  it('restores an expired consumed quote without requiring the goods to remain publicly listed', async () => {
    const createOrder = vi.fn()
    const readPublicGoods = vi.fn(async () => { throw new Error('没有可公开的已审核商品快照') })
    const onQuoteRecovery = vi.fn()
    const onOrder = vi.fn()
    const controller = createRestoredCheckoutController({
      readPublicGoods, createQuote: vi.fn(), createOrder,
      recoverQuote: async () => ({ quote: quote('STANDARD', { expiresAt: '2020-01-01T00:00:00.000Z' }), orderId: 'order-existing' }),
    }, { onQuoteRecovery, onOrder, keyFactory: kind => `${kind}-key` })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD', quoteId: 'quote-standard', createKey: 'create-original-key' })
    expect(onOrder).toHaveBeenCalledWith('order-existing', 'quote-standard')
    expect(onQuoteRecovery).toHaveBeenCalledWith('quote-standard', 'create-original-key')
    expect(readPublicGoods).not.toHaveBeenCalled()
    expect(createOrder).not.toHaveBeenCalled()
  })

  it('retries the authoritative quote recovery after a temporary GET failure without creating a new quote or losing its key', async () => {
    const createQuote = vi.fn()
    const recoverQuote = vi.fn()
      .mockRejectedValueOnce(new Error('temporary read failure'))
      .mockResolvedValueOnce({ quote: quote(), orderId: 'order-existing' })
    const onQuoteRecovery = vi.fn()
    const onOrder = vi.fn()
    const controller = createRestoredCheckoutController({
      readPublicGoods: async () => goods(), createQuote, recoverQuote, createOrder: vi.fn(),
    }, { onQuoteRecovery, onOrder, keyFactory: kind => `${kind}-must-not-replace` })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD', quoteId: 'quote-standard', createKey: 'create-original-key' })
    expect(controller.getSnapshot()).toMatchObject({ quote: null, error: 'temporary read failure' })
    await controller.retryLoad()
    expect(recoverQuote).toHaveBeenCalledTimes(2)
    expect(createQuote).not.toHaveBeenCalled()
    expect(onQuoteRecovery).toHaveBeenCalledWith('quote-standard', 'create-original-key')
    expect(onOrder).toHaveBeenCalledWith('order-existing', 'quote-standard')
  })

  it('requests a fresh quote for the same package after the previous quote expires', async () => {
    const createQuote = vi.fn()
      .mockResolvedValueOnce(quote('STANDARD', { quoteId: 'quote-expired', expiresAt: '2020-01-01T00:00:00.000Z' }))
      .mockResolvedValueOnce(quote('STANDARD', { quoteId: 'quote-fresh' }))
    const controller = createRestoredCheckoutController({ readPublicGoods: async () => goods(), createQuote, recoverQuote: vi.fn(), createOrder: vi.fn() }, {
      onQuoteRecovery: vi.fn(), onOrder: vi.fn(), keyFactory: kind => `${kind}-${createQuote.mock.calls.length}-key`,
    })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD' })
    expect(controller.getSnapshot().error).toMatch(/过期/)
    await controller.refreshQuote()
    expect(controller.getSnapshot()).toMatchObject({ quote: { quoteId: 'quote-fresh' }, error: null })
  })

  it('freezes package and quote refresh while an unknown create must recover the original quote/key', async () => {
    const createQuote = vi.fn(async () => quote())
    const controller = createRestoredCheckoutController({
      readPublicGoods: async () => goods(), createQuote,
      recoverQuote: vi.fn(async () => ({ quote: quote(), orderId: null })),
      createOrder: vi.fn(async () => { throw new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '结果未知', 'UNKNOWN') }),
    }, { onQuoteRecovery: vi.fn(), onOrder: vi.fn(), keyFactory: kind => `${kind}-frozen-key` })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD' })
    await controller.submitOrder()
    expect(controller.getSnapshot().createUnknown).toBe(true)
    await controller.selectPackage('PREMIUM')
    await controller.refreshQuote()
    expect(createQuote).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot()).toMatchObject({ packageId: 'STANDARD', quote: { quoteId: 'quote-standard' }, createUnknown: true })
  })

  it('restores the original non-sensitive create key from the quote URL after hard refresh', async () => {
    const createOrder = vi.fn(async (_quoteId: string, _key: string, _signal?: AbortSignal) => ({ order: { id: 'order-1', status: 'PENDING_PAYMENT' as const, rowVersion: 1 }, operation: null }))
    const onQuoteRecovery = vi.fn()
    const controller = createRestoredCheckoutController({
      readPublicGoods: async () => goods(), createQuote: vi.fn(), createOrder,
      recoverQuote: async () => ({ quote: quote(), orderId: null }),
    }, { onQuoteRecovery, onOrder: vi.fn(), keyFactory: kind => `${kind}-new-key` })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD', quoteId: 'quote-standard', createKey: 'create-original-key' })
    await controller.submitOrder()
    expect(onQuoteRecovery).toHaveBeenCalledWith('quote-standard', 'create-original-key')
    expect(createOrder.mock.calls[0][1]).toBe('create-original-key')
  })

  it('does not navigate back from a late create response after the checkout route unmounts', async () => {
    const pendingCreate = deferred<RestoredPurchaseAction>()
    const onOrder = vi.fn()
    const controller = createRestoredCheckoutController({ readPublicGoods: async () => goods(), createQuote: async () => quote(), recoverQuote: vi.fn(), createOrder: () => pendingCreate.promise }, {
      onQuoteRecovery: vi.fn(), onOrder, keyFactory: kind => `${kind}-fixed-key`,
    })
    await controller.start({ goodsId: 'harness-purchase-goods', packageId: 'STANDARD' })
    const submitting = controller.submitOrder()
    controller.stop()
    pendingCreate.resolve({ order: { id: 'order-late', status: 'PENDING_PAYMENT', rowVersion: 1 }, operation: null })
    await submitting
    expect(onOrder).not.toHaveBeenCalled()
  })
})

describe('restored same-order payment controller', () => {
  it('uses a new operation after a formal failure but never creates another order', async () => {
    const ids = ['operation-failed', 'operation-succeeded']
    const submitPayment = vi.fn()
      .mockResolvedValueOnce(action('FAILED', ids[0]))
      .mockResolvedValueOnce(action('SUCCEEDED', ids[1], 5))
    const recoveries: Array<RestoredPaymentRecovery | null> = []
    const api = { readOrder: vi.fn(async () => ownedOrder()), readPaymentContext: vi.fn(async () => context()), submitPayment }
    const controller = createRestoredPaymentController(api, { onRecovery: value => recoveries.push(value), operationFactory: () => ids.shift()!, onSettled: vi.fn() })
    await controller.start('order-1')
    await controller.startPayment('FAILED')
    await controller.startPayment('SUCCESS')
    expect(submitPayment.mock.calls.map(call => [call[0], call[1].operationId, call[1].simulatedResult])).toEqual([
      ['order-1', 'operation-failed', 'FAILED'], ['order-1', 'operation-succeeded', 'SUCCESS'],
    ])
    expect(submitPayment.mock.calls[1][1].simulatedReceiptRef).toBe('LOCAL-DEMO-operation-succeeded')
    expect(recoveries.filter(Boolean).map(item => item?.operationId)).toEqual(['operation-failed', 'operation-succeeded'])
  })

  it('keeps the frozen rowVersion/body/key for an unknown original retry even after refresh returns a newer version', async () => {
    const recovery: RestoredPaymentRecovery = { operationId: 'operation-unknown', simulatedResult: 'UNKNOWN', rowVersion: 4 }
    const readPaymentContext = vi.fn()
      .mockResolvedValueOnce(context({ rowVersion: 4, canStartPayment: false, blockedReason: '存在未决操作', operation: action('UNKNOWN', 'operation-unknown').operation }))
      .mockResolvedValueOnce(context({ rowVersion: 5, canStartPayment: false, blockedReason: '存在未决操作', operation: action('UNKNOWN', 'operation-unknown').operation }))
    const submitPayment = vi.fn(async (_orderId: string, _input: { rowVersion: number; operationId: string; simulatedResult: 'SUCCESS' | 'FAILED' | 'UNKNOWN'; simulatedReceiptRef?: string }, _key: string) => action('UNKNOWN', 'operation-unknown'))
    const controller = createRestoredPaymentController({ readOrder: async () => ownedOrder(), readPaymentContext, submitPayment }, { onRecovery: vi.fn(), operationFactory: vi.fn(), onSettled: vi.fn() })
    await controller.start('order-1', recovery)
    await controller.retryOriginal()
    expect(submitPayment).toHaveBeenCalledTimes(1)
    expect(submitPayment.mock.calls[0][1]).toEqual({ rowVersion: 4, operationId: 'operation-unknown', simulatedResult: 'UNKNOWN' })
    expect(submitPayment.mock.calls[0][2]).toMatch(/^payment-[0-9a-f]{64}$/u)
    expect(controller.getSnapshot().pending).toEqual(recovery)
  })

  it('resolves UNKNOWN with the same operation, latest rowVersion, a new key, and a stable local-only receipt', async () => {
    const recovery: RestoredPaymentRecovery = { operationId: 'operation-unknown', simulatedResult: 'UNKNOWN', rowVersion: 4 }
    const unknown = action('UNKNOWN', 'operation-unknown').operation
    const readPaymentContext = vi.fn()
      .mockResolvedValueOnce(context({ rowVersion: 4, canStartPayment: false, blockedReason: '存在未决操作', operation: unknown }))
      .mockResolvedValueOnce(context({ rowVersion: 6, canStartPayment: false, blockedReason: '存在未决操作', operation: unknown }))
      .mockResolvedValue(context({ rowVersion: 7, canStartPayment: false, blockedReason: '已支付', operation: action('SUCCEEDED', 'operation-unknown', 7).operation }))
    const submitPayment = vi.fn(async (_orderId: string, _input: { rowVersion: number; operationId: string; simulatedResult: 'SUCCESS' | 'FAILED' | 'UNKNOWN'; simulatedReceiptRef?: string }, _key: string) => action('SUCCEEDED', 'operation-unknown', 7))
    const onRecovery = vi.fn()
    const onSettled = vi.fn()
    const controller = createRestoredPaymentController({ readOrder: async () => ownedOrder(), readPaymentContext, submitPayment }, { onRecovery, operationFactory: vi.fn(), onSettled })
    await controller.start('order-1', recovery)
    await controller.resolveUnknown('SUCCESS')
    expect(submitPayment.mock.calls[0][1]).toEqual({ rowVersion: 6, operationId: 'operation-unknown', simulatedResult: 'SUCCESS', simulatedReceiptRef: 'LOCAL-DEMO-operation-unknown' })
    expect(submitPayment.mock.calls[0][2]).toMatch(/^payment-[0-9a-f]{64}$/u)
    expect(onRecovery).toHaveBeenCalledWith({ operationId: 'operation-unknown', simulatedResult: 'SUCCESS', rowVersion: 6 })
    expect(onRecovery).toHaveBeenLastCalledWith(null)
    expect(onSettled).toHaveBeenCalledWith('SUCCEEDED')
  })

  it.each([
    { result: 'SUCCESS' as const, terminal: 'SUCCEEDED' as const, hardRefresh: true, queryFails: false },
    { result: 'FAILED' as const, terminal: 'FAILED' as const, hardRefresh: false, queryFails: true },
  ])('retries a lost $result resolution with the identical body/key and no new operation (hardRefresh=$hardRefresh)', async ({ result, terminal, hardRefresh, queryFails }) => {
    const operationId = 'operation-unknown'
    const original: RestoredPaymentRecovery = { operationId, simulatedResult: 'UNKNOWN', rowVersion: 4 }
    const unknown = action('UNKNOWN', operationId).operation
    const unresolved = context({ rowVersion: 6, canStartPayment: false, blockedReason: '存在未决操作', operation: unknown })
    const readPaymentContext = vi.fn()
      .mockResolvedValueOnce(context({ rowVersion: 4, canStartPayment: false, blockedReason: '存在未决操作', operation: unknown }))
      .mockResolvedValueOnce(unresolved)
    if (queryFails) readPaymentContext.mockRejectedValueOnce(new Error('temporary query failure'))
    else readPaymentContext.mockResolvedValueOnce(unresolved)
    if (hardRefresh) readPaymentContext.mockResolvedValueOnce(unresolved)
    readPaymentContext.mockResolvedValueOnce(unresolved)
    const submitPayment = vi.fn()
      .mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', 'response lost', 'UNKNOWN'))
      .mockResolvedValueOnce(action(terminal, operationId, 7))
    const operationFactory = vi.fn(() => 'must-not-create-operation')
    const recoveries: Array<RestoredPaymentRecovery | null> = []
    const api = { readOrder: vi.fn(async () => ownedOrder()), readPaymentContext, submitPayment }
    let controller = createRestoredPaymentController(api, { onRecovery: value => recoveries.push(value), operationFactory, onSettled: vi.fn() })
    await controller.start('order-1', original)
    await controller.resolveUnknown(result)
    const resolvedRecovery = controller.getSnapshot().pending
    expect(resolvedRecovery).toEqual({ operationId, simulatedResult: result, rowVersion: 6 })
    if (hardRefresh) {
      controller.stop()
      controller = createRestoredPaymentController(api, { onRecovery: value => recoveries.push(value), operationFactory, onSettled: vi.fn() })
      await controller.start('order-1', resolvedRecovery)
    }
    await controller.retryOriginal()
    expect(submitPayment).toHaveBeenCalledTimes(2)
    expect(submitPayment.mock.calls[1][1]).toEqual(submitPayment.mock.calls[0][1])
    expect(submitPayment.mock.calls[1][2]).toBe(submitPayment.mock.calls[0][2])
    expect(submitPayment.mock.calls[0][2]).toMatch(/^payment-[0-9a-f]{64}$/u)
    expect(operationFactory).not.toHaveBeenCalled()
    expect(recoveries).toContainEqual({ operationId, simulatedResult: result, rowVersion: 6 })
  })

  it('does not allow a seller, historical record, terminal order, or lost payment context to start payment', async () => {
    const submitPayment = vi.fn()
    const controller = createRestoredPaymentController({
      readOrder: async () => ownedOrder({ viewRoles: ['SELLER'], provenance: 'UNVERIFIED', status: 'COMPLETED' }),
      readPaymentContext: async () => context({ canStartPayment: false, blockedReason: '历史关系缺失' }), submitPayment,
    }, { onRecovery: vi.fn(), operationFactory: () => 'operation-blocked', onSettled: vi.fn() })
    await controller.start('order-1')
    await controller.startPayment('SUCCESS')
    expect(submitPayment).not.toHaveBeenCalled()
    expect(controller.getSnapshot().error).toMatch(/只有订单买家|历史关系缺失|不允许/)
  })

  it('isolates a late response from a previous order route', async () => {
    const firstOrder = deferred<RestoredOwnedOrder>(), firstContext = deferred<RestoredPaymentContext>()
    const api = {
      readOrder: vi.fn((id: string) => id === 'order-1' ? firstOrder.promise : Promise.resolve(ownedOrder({ id: 'order-2', orderNo: 'ORDER-2' }))),
      readPaymentContext: vi.fn((id: string) => id === 'order-1' ? firstContext.promise : Promise.resolve(context({ orderId: 'order-2' }))),
      submitPayment: vi.fn(),
    }
    const controller = createRestoredPaymentController(api, { onRecovery: vi.fn(), operationFactory: vi.fn(), onSettled: vi.fn() })
    const old = controller.start('order-1')
    const current = controller.load('order-2')
    await current
    firstOrder.resolve(ownedOrder()); firstContext.resolve(context()); await old
    expect(controller.getSnapshot()).toMatchObject({ orderId: 'order-2', order: { id: 'order-2' }, context: { orderId: 'order-2' } })
  })

  it('does not settle or navigate from a late payment response after leaving the route', async () => {
    const pendingPayment = deferred<RestoredPurchaseAction>()
    const onSettled = vi.fn()
    const controller = createRestoredPaymentController({ readOrder: async () => ownedOrder(), readPaymentContext: async () => context(), submitPayment: () => pendingPayment.promise }, {
      onRecovery: vi.fn(), operationFactory: () => 'operation-late', onSettled,
    })
    await controller.start('order-1')
    const submitting = controller.startPayment('SUCCESS')
    controller.stop()
    pendingPayment.resolve(action('SUCCEEDED', 'operation-late', 5))
    await submitting
    expect(onSettled).not.toHaveBeenCalled()
  })
})
