import { describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from './restoredLinkedTransport'
import { createRestoredRecycleOrderController, type RestoredRecycleOrder } from './restoredRecycleOrderController'

const order = (overrides: Partial<RestoredRecycleOrder> = {}): RestoredRecycleOrder => ({
  recycleOrderId: 'recycle-order-1', recycleOrderNo: 'RC202601', status: 'active', recycleConsultationId: 'consult-1',
  sellerManagementId: 'seller-1', sellerName: '测试卖家', recyclerId: 'shop-1', recyclerName: '测试回收商',
  loginAccount: 'player_001', quoteAmountFen: 10000, guaranteeFeeAmountFen: 1000, guaranteeFeeRate: '0.1',
  sellerReceivableAmountFen: 10000, buyerPayAmountFen: 11000, paymentStatus: null, description: '', validUntil: Date.now() + 60_000,
  ...overrides,
})
const identity = (role: 'seller' | 'recycler') => role === 'seller'
  ? { managementId: 'seller-1', recyclerId: null }
  : { managementId: 'mgmt-shop-1', recyclerId: 'shop-1' }
const baseApi = () => ({
  readOrder: vi.fn(), createQuote: vi.fn(), confirmOrder: vi.fn(), rejectOrder: vi.fn(), payOrder: vi.fn(),
})
const keys = () => { const seq = ['k1', 'k2', 'k3', 'k4', 'k5']; let index = 0; return () => seq[index++ % seq.length]! }

describe('restored recycle order controller', () => {
  it('treats a missing order as the quote-eligible state for the consultation recycler only', async () => {
    const notFound = new RestoredHttpError(404, 'RECYCLE_ORDER_NOT_FOUND', '该咨询尚无回收订单')
    const recyclerApi = baseApi(); recyclerApi.readOrder.mockRejectedValue(notFound)
    const recycler = createRestoredRecycleOrderController('consult-1', recyclerApi as never, identity('recycler'), 'shop-1', keys())
    await recycler.start()
    expect(recycler.getSnapshot()).toMatchObject({ loading: false, order: null, canQuote: true, role: 'recycler', error: null })
    recycler.stop()

    const sellerApi = baseApi(); sellerApi.readOrder.mockRejectedValue(notFound)
    const seller = createRestoredRecycleOrderController('consult-1', sellerApi as never, identity('seller'), 'shop-1', keys())
    await seller.start()
    expect(seller.getSnapshot()).toMatchObject({ order: null, canQuote: false, role: 'none' })
    seller.stop()

    const strangerApi = baseApi(); strangerApi.readOrder.mockRejectedValue(notFound)
    const stranger = createRestoredRecycleOrderController('consult-1', strangerApi as never, { managementId: 'someone', recyclerId: 'other-shop' }, 'shop-1', keys())
    await stranger.start()
    expect(stranger.getSnapshot().canQuote).toBe(false)
    stranger.stop()
  })

  it('quotes with a frozen idempotency key and replays the same key on unknown retry', async () => {
    const api = baseApi()
    api.readOrder.mockRejectedValue(new RestoredHttpError(404, 'RECYCLE_ORDER_NOT_FOUND', '尚无'))
    api.createQuote.mockRejectedValueOnce(new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '网络中断', 'UNKNOWN'))
      .mockResolvedValueOnce(order())
    const controller = createRestoredRecycleOrderController('consult-1', api as never, identity('recycler'), 'shop-1', keys())
    await controller.start()
    await controller.quote({ quoteAmountFen: 10000, loginAccount: 'player_001' })
    expect(controller.getSnapshot()).toMatchObject({ actionState: 'unknown', busy: false, lastAction: 'quote' })
    await controller.retryUnknown()
    expect(api.createQuote).toHaveBeenCalledTimes(2)
    expect(api.createQuote.mock.calls[0][2]).toBe(api.createQuote.mock.calls[1][2])
    expect(controller.getSnapshot()).toMatchObject({ actionState: 'idle', order: { status: 'active' }, role: 'recycler' })
    controller.stop()
  })

  it('keeps confirm/reject/pay on the right role and right status, and converges after hard refresh', async () => {
    const api = baseApi()
    api.readOrder.mockResolvedValue(order())
    const seller = createRestoredRecycleOrderController('consult-1', api as never, identity('seller'), 'shop-1', keys())
    await seller.start()
    expect(seller.getSnapshot()).toMatchObject({ role: 'seller', order: { status: 'active' } })
    // 卖家不能支付。
    await seller.pay()
    expect(api.payOrder).not.toHaveBeenCalled()
    api.confirmOrder.mockResolvedValue(order({ status: 'pending_payment' }))
    await seller.confirm()
    expect(api.confirmOrder).toHaveBeenCalledWith('consult-1', 'active', expect.stringMatching(/^client-recycle-order-confirm-/), expect.anything())
    expect(seller.getSnapshot().order?.status).toBe('pending_payment')
    seller.stop()

    const recyclerApi = baseApi()
    recyclerApi.readOrder.mockResolvedValue(order({ status: 'pending_payment' }))
    const recycler = createRestoredRecycleOrderController('consult-1', recyclerApi as never, identity('recycler'), 'shop-1', keys())
    await recycler.start()
    await recycler.confirm()
    await recycler.reject('回收商不能拒绝')
    expect(recyclerApi.confirmOrder).not.toHaveBeenCalled()
    expect(recyclerApi.rejectOrder).not.toHaveBeenCalled()
    recyclerApi.payOrder.mockResolvedValue(order({ status: 'completed', paymentStatus: 'PAID' }))
    await recycler.pay()
    expect(recyclerApi.payOrder).toHaveBeenCalledWith('consult-1', 'pending_payment', expect.stringMatching(/^client-recycle-order-pay-/), expect.anything())
    expect(recycler.getSnapshot()).toMatchObject({ order: { status: 'completed', paymentStatus: 'PAID' }, actionState: 'idle' })

    // 硬刷新：GET 直接返回服务端真实状态，动作尝试清空。
    recyclerApi.readOrder.mockResolvedValue(order({ status: 'completed', paymentStatus: 'PAID' }))
    await recycler.refresh()
    expect(recycler.getSnapshot()).toMatchObject({ order: { status: 'completed' }, actionState: 'idle', lastAction: null })
    recycler.stop()
  })

  it('surfaces failed actions without losing the current order', async () => {
    const api = baseApi()
    api.readOrder.mockResolvedValue(order())
    api.confirmOrder.mockRejectedValue(new RestoredHttpError(409, 'RECYCLE_ORDER_STATUS_CHANGED', '状态已变化'))
    const seller = createRestoredRecycleOrderController('consult-1', api as never, identity('seller'), 'shop-1', keys())
    await seller.start()
    await seller.confirm()
    expect(seller.getSnapshot()).toMatchObject({ actionState: 'idle', actionError: '状态已变化', order: { status: 'active' } })
    seller.stop()
  })
})
