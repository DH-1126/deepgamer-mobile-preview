import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RestoredHttpError } from '../linked/restoredLinkedTransport'
import type { RestoredOwnedOrder } from '../linked/restoredOrderApi'
import { createRestoredOrderDetailController, createRestoredOrdersController, projectRestoredOrderDetailSnapshot, projectRestoredOrdersSnapshot, RestoredOrderDetailView, RestoredOrderListView } from './RestoredOrderPages'

function order(id: string, overrides: Partial<RestoredOwnedOrder> = {}): RestoredOwnedOrder {
  return {
    id, orderNo: `NO-${id}`, status: 'AFTER_SALE', statusLabel: '售后中', rowVersion: 3,
    goods: { goodsNo: 'GOODS-1', title: '合成账号', coverUrl: null, game: { code: 'wzry', name: '王者荣耀', iconUrl: null }, accountMasked: '***123', regionName: '微信区', serverName: '一区' },
    buyer: { userRef: 'buyer-1', displayName: '合成买家' }, seller: { userRef: 'seller-1', displayName: '合成卖家' }, viewRoles: ['BUYER'],
    amountFen: 128_001, paidAmountFen: 128_001, refundedAmountFen: 0, currency: 'CNY',
    payment: { paymentNo: null, paymentChannel: 'ALIPAY', goodsAmountFen: 120_000, serviceFeeFen: 8_001, discountFen: 0, payableAmountFen: 128_001, paidAmountFen: 128_001, paidAt: '2026-09-28T04:00:00.000Z', refundAmountFen: 0, refundedAt: null },
    afterSaleEntryEnabled: true, createdAt: '2026-09-28T03:00:00.000Z', updatedAt: '2026-09-28T04:10:00.000Z', paidAt: '2026-09-28T04:00:00.000Z', completedAt: null, cancelledAt: null,
    provenance: 'LOCAL_DEMO', trade: null,
    financials: { provenance: 'LOCAL_DEMO', amounts: { goodsAmountFen: 120_000, serviceFeeFen: 8_001, guaranteeFeeFen: 0, discountFen: 0, payableAmountFen: 128_001 }, paidAmountFen: 128_001, refundedAmountFen: 0, pendingRefundAmountFen: 128_001 },
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

describe('restored order controllers', () => {
  afterEach(() => { vi.useRealTimers() })

  it('refreshes refund facts after five seconds, pauses hidden, resumes immediately, and stops cleanly', async () => {
    vi.useFakeTimers()
    let refunded = 0
    const read = vi.fn(async (id: string) => order(id, { refundedAmountFen: refunded, financials: { ...order(id).financials!, refundedAmountFen: refunded, pendingRefundAmountFen: 128001 - refunded } }))
    const controller = createRestoredOrderDetailController({ read })
    await controller.start('order-1')
    refunded = 128001
    await vi.advanceTimersByTimeAsync(5000)
    expect(controller.getSnapshot().order?.financials?.refundedAmountFen).toBe(128001)
    await controller.setVisible(false)
    await vi.advanceTimersByTimeAsync(20000)
    expect(read).toHaveBeenCalledTimes(2)
    await controller.setVisible(true)
    expect(read).toHaveBeenCalledTimes(3)
    controller.stop()
    await vi.advanceTimersByTimeAsync(30000)
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('backs off failed list refreshes while keeping stale facts, then clears private rows on lost permission', async () => {
    vi.useFakeTimers()
    let failure: Error | null = null
    const listAll = vi.fn(async () => { if (failure) throw failure; return [order('order-1')] })
    const controller = createRestoredOrdersController({ listAll })
    await controller.start('buy')
    failure = new Error('连接失败')
    await vi.advanceTimersByTimeAsync(5000)
    expect(controller.getSnapshot()).toMatchObject({ stale: true, error: '连接失败', orders: [{ id: 'order-1' }] })
    await vi.advanceTimersByTimeAsync(5000)
    expect(listAll).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(9999)
    expect(listAll).toHaveBeenCalledTimes(3)
    failure = new RestoredHttpError(403, 'FORBIDDEN', '无权限')
    await vi.advanceTimersByTimeAsync(1)
    expect(controller.getSnapshot()).toMatchObject({ stale: false, error: '无权限', orders: [] })
    controller.stop()
  })

  it('hides a detail when current ownership is lost instead of retaining a formerly readable refund', async () => {
    const read = vi.fn().mockResolvedValueOnce(order('order-1')).mockRejectedValueOnce(new RestoredHttpError(404, 'NOT_FOUND', '订单不可读'))
    const controller = createRestoredOrderDetailController({ read })
    await controller.start('order-1')
    await controller.retry()
    expect(controller.getSnapshot()).toMatchObject({ order: null, stale: false, error: '订单不可读' })
    controller.stop()
  })

  it('keeps stale refund facts labelled while retry is pending and ignores a response after hiding', async () => {
    vi.useFakeTimers()
    const pending = deferred<RestoredOwnedOrder>()
    const read = vi.fn().mockResolvedValueOnce(order('order-1')).mockRejectedValueOnce(new Error('离线')).mockReturnValueOnce(pending.promise)
    const controller = createRestoredOrderDetailController({ read })
    await controller.start('order-1')
    await controller.retry()
    const retry = controller.retry()
    expect(controller.getSnapshot()).toMatchObject({ loading: true, stale: true, error: '离线' })
    await controller.setVisible(false)
    pending.resolve(order('order-1', { refundedAmountFen: 128001 }))
    await retry
    expect(controller.getSnapshot().order?.refundedAmountFen).toBe(0)
    await vi.advanceTimersByTimeAsync(30000)
    expect(read).toHaveBeenCalledTimes(3)
    controller.stop()
  })

  it('defers a hidden list view change until visible without showing the prior role rows', async () => {
    vi.useFakeTimers()
    const listAll = vi.fn(async (view: 'buy' | 'sell') => [order(view, { viewRoles: view === 'buy' ? ['BUYER'] : ['SELLER'] })])
    const controller = createRestoredOrdersController({ listAll })
    await controller.start('buy')
    await controller.setVisible(false)
    await controller.setView('sell')
    expect(controller.getSnapshot()).toMatchObject({ view: 'sell', orders: [] })
    expect(listAll).toHaveBeenCalledTimes(1)
    await controller.setVisible(true)
    expect(controller.getSnapshot().orders[0].id).toBe('sell')
    controller.stop()
  })
  it('does not let a late buy response replace the selected sell view', async () => {
    const buy = deferred<RestoredOwnedOrder[]>(), sell = deferred<RestoredOwnedOrder[]>()
    const api = { listAll: vi.fn((view: 'buy' | 'sell') => view === 'buy' ? buy.promise : sell.promise) }
    const controller = createRestoredOrdersController(api)
    const first = controller.start('buy')
    const switched = controller.setView('sell')
    sell.resolve([order('sell-1', { viewRoles: ['SELLER'] })]); await switched
    buy.resolve([order('buy-1')]); await first
    expect(controller.getSnapshot()).toMatchObject({ view: 'sell', loading: false, error: null, orders: [{ id: 'sell-1' }] })
  })

  it('does not let a late previous detail replace the current order id', async () => {
    const first = deferred<RestoredOwnedOrder>(), second = deferred<RestoredOwnedOrder>()
    const api = { read: vi.fn((id: string) => id === 'order-1' ? first.promise : second.promise) }
    const controller = createRestoredOrderDetailController(api)
    const oldLoad = controller.start('order-1')
    const newLoad = controller.load('order-2')
    second.resolve(order('order-2')); await newLoad
    first.resolve(order('order-1')); await oldLoad
    expect(controller.getSnapshot()).toMatchObject({ orderId: 'order-2', loading: false, order: { id: 'order-2' } })
  })

  it('delegates normal-state refreshes to the current list view and order id', async () => {
    const listAll = vi.fn(async (view: 'buy' | 'sell') => [order(`${view}-${listAll.mock.calls.length}`, { viewRoles: view === 'buy' ? ['BUYER'] : ['SELLER'] })])
    const list = createRestoredOrdersController({ listAll })
    await list.start('sell')
    await list.retry()
    expect(listAll.mock.calls.map(call => call[0])).toEqual(['sell', 'sell'])

    const read = vi.fn(async (id: string) => order(id))
    const detail = createRestoredOrderDetailController({ read })
    await detail.start('order-2')
    await detail.retry()
    expect(read.mock.calls.map(call => call[0])).toEqual(['order-2', 'order-2'])
  })

  it('projects route changes to an empty loading snapshot before effects run', () => {
    const projectedList = projectRestoredOrdersSnapshot({ view: 'buy', orders: [order('buy-1')], loading: false, stale: false, error: null }, 'sell')
    expect(projectedList).toEqual({ view: 'sell', orders: [], loading: true, stale: false, error: null })
    const projectedDetail = projectRestoredOrderDetailSnapshot({ orderId: 'order-1', order: order('order-1'), loading: false, stale: false, error: null }, 'order-2')
    expect(projectedDetail).toEqual({ orderId: 'order-2', order: null, loading: true, stale: false, error: null })
  })
})

describe('restored order views', () => {
  it.each([
    [128001, 0, '退款尚未完成'],
    [100001, 28000, '部分金额已退，仍有待退款'],
    [0, 128001, '当前无待退款义务'],
    [0, 0, '暂无退款记录'],
  ])('renders authoritative pending %s / refunded %s without advancing the business state', (pending, refunded, label) => {
    const entry = order('closed-1', { status: 'CANCELLED', statusLabel: '已关闭', financials: { ...order('closed-1').financials!, pendingRefundAmountFen: pending, refundedAmountFen: refunded } })
    const html = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderDetailView snapshot={{ orderId: 'closed-1', order: entry, loading: false, stale: false, error: null }} returnView="buy" onRetry={vi.fn()} /></StaticRouter>)
    expect(html).toContain('退款进度')
    expect(html).toContain(label)
    expect(html).toContain('CANCELLED')
    expect(html).not.toMatch(/(?:已到账|退款失败|执行退款|模拟退款成功)/)
  })

  it('does not present unavailable or historical refund facts as a completed refund', () => {
    for (const financials of [null, { provenance: 'UNVERIFIED' as const, amounts: null, paidAmountFen: 25000, refundedAmountFen: 5000, pendingRefundAmountFen: null }]) {
      const entry = order('history', { provenance: 'UNVERIFIED', financials })
      const html = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderDetailView snapshot={{ orderId: 'history', order: entry, loading: false, stale: false, error: null }} returnView="buy" onRetry={vi.fn()} /></StaticRouter>)
      expect(html).not.toContain('当前无待退款义务')
      expect(html).not.toContain('暂无退款记录')
    }
  })
  it('renders an owned read-only list with original status, local marker, and subject-safe detail URL', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/orders?view=buy"><RestoredOrderListView snapshot={{ view: 'buy', orders: [order('order-1')], loading: false, stale: false, error: null }} onViewChange={vi.fn()} onRetry={vi.fn()} /></StaticRouter>)
    expect(html).toContain('本人买卖订单')
    expect(html).toContain('买入订单')
    expect(html).toContain('卖出订单')
    expect(html).toContain('本地演示')
    expect(html).toContain('原始状态：AFTER_SALE')
    expect(html).toContain('待退款义务')
    expect(html).toContain('¥1,280.01')
    expect(html).toContain('刷新订单')
    expect(html).toContain('本地演示订单未接入真实支付或退款')
    expect(html).toContain('href="/orders/order-1?view=buy"')
    expect(html).not.toContain('href="/orders/order-1/payment"')
    expect(html).not.toMatch(/(?:取消订单|申请售后)/)
  })

  it('renders empty and failed reads honestly with an explicit retry', () => {
    const empty = renderToStaticMarkup(<StaticRouter location="/orders"><RestoredOrderListView snapshot={{ view: 'buy', orders: [], loading: false, stale: false, error: null }} onViewChange={vi.fn()} onRetry={vi.fn()} /></StaticRouter>)
    expect(empty).toContain('暂无本人买入订单')
    const failed = renderToStaticMarkup(<StaticRouter location="/orders"><RestoredOrderListView snapshot={{ view: 'buy', orders: [], loading: false, stale: false, error: '订单读取失败' }} onViewChange={vi.fn()} onRetry={vi.fn()} /></StaticRouter>)
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('重试读取')
    expect(failed).not.toContain('暂无本人买入订单')
  })

  it('shows frozen, paid, pending refund, and refunded facts independently in detail', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/orders/order-1?view=buy"><RestoredOrderDetailView snapshot={{ orderId: 'order-1', order: order('order-1'), loading: false, stale: false, error: null }} returnView="buy" onRetry={vi.fn()} /></StaticRouter>)
    expect(html).toContain('商品金额')
    expect(html).toContain('¥1,200.00')
    expect(html).toContain('服务费')
    expect(html).toContain('¥80.01')
    expect(html).toContain('冻结应付')
    expect(html).toContain('已付金额')
    expect(html).toContain('待退款义务')
    expect(html).toContain('已退款金额')
    expect(html).toContain('¥0.00')
    expect(html).toContain('已记录待退款，退款尚未完成；订单关闭不代表未扣款')
    expect(html).toContain('刷新详情')
    expect(html).not.toContain('已到账')
    expect(html).not.toContain('原路退款成功')
    expect(html).not.toMatch(/(?:去支付|取消订单|申请售后)/)
  })

  it('marks legacy and historical monetary facts unavailable without inventing zero pending refund', () => {
    const legacyHtml = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderDetailView snapshot={{ orderId: 'legacy-1', order: order('legacy-1', { financials: null }), loading: false, stale: false, error: null }} returnView="buy" onRetry={vi.fn()} /></StaticRouter>)
    expect(legacyHtml).toContain('金额事实暂不可用')
    const history = order('history-1', { provenance: 'UNVERIFIED', financials: { provenance: 'UNVERIFIED', amounts: null, paidAmountFen: 25_000, refundedAmountFen: 5_000, pendingRefundAmountFen: null } })
    const historyHtml = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderDetailView snapshot={{ orderId: 'history-1', order: history, loading: false, stale: false, error: null }} returnView="sell" onRetry={vi.fn()} /></StaticRouter>)
    expect(historyHtml).toContain('历史关系未核验，仅可查看')
    expect(historyHtml).toContain('待退款事实暂不可用')
    expect(historyHtml).not.toContain('待退款义务</dt><dd>¥0.00')
  })

  it('shows same-order payment only for owned local pending orders', () => {
    const pendingList = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderListView snapshot={{ view: 'buy', orders: [order('order-1', { status: 'PENDING_PAYMENT', statusLabel: '待付款' })], loading: false, stale: false, error: null }} onViewChange={vi.fn()} onRetry={vi.fn()} /></StaticRouter>)
    expect(pendingList).toContain('href="/orders/order-1/payment"')
    const pending = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderDetailView snapshot={{ orderId: 'order-1', order: order('order-1', { status: 'PENDING_PAYMENT', statusLabel: '待付款' }), loading: false, stale: false, error: null }} returnView="buy" onRetry={vi.fn()} /></StaticRouter>)
    expect(pending).toContain('href="/orders/order-1/payment"')
    const seller = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderDetailView snapshot={{ orderId: 'order-1', order: order('order-1', { status: 'PENDING_PAYMENT', statusLabel: '待付款', viewRoles: ['SELLER'] }), loading: false, stale: false, error: null }} returnView="sell" onRetry={vi.fn()} /></StaticRouter>)
    const history = renderToStaticMarkup(<StaticRouter location="/"><RestoredOrderDetailView snapshot={{ orderId: 'order-1', order: order('order-1', { status: 'PENDING_PAYMENT', statusLabel: '待付款', provenance: 'UNVERIFIED' }), loading: false, stale: false, error: null }} returnView="buy" onRetry={vi.fn()} /></StaticRouter>)
    expect(seller + history).not.toContain('/payment')
  })
})
