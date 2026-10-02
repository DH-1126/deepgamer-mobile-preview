import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RecycleOrderPanelView } from './RestoredRecycleOrderPanel'
import type { RestoredRecycleOrderSnapshot } from '../linked/restoredRecycleOrderController'

const snapshot = (overrides: Partial<RestoredRecycleOrderSnapshot> = {}): RestoredRecycleOrderSnapshot => ({
  loading: false, stale: false, error: null,
  order: {
    recycleOrderId: 'order-1', recycleOrderNo: 'RC202601', status: 'active', recycleConsultationId: 'consult-1',
    sellerManagementId: 'seller-1', sellerName: '测试卖家', recyclerId: 'shop-1', recyclerName: '测试回收商',
    loginAccount: 'player_001', quoteAmountFen: 10000, guaranteeFeeAmountFen: 1000, guaranteeFeeRate: '0.1',
    sellerReceivableAmountFen: 10000, buyerPayAmountFen: 11000, paymentStatus: null, description: '', validUntil: Date.now() + 60_000,
  },
  canQuote: false, role: 'seller', busy: false, actionState: 'idle', actionError: null, lastAction: null,
  ...overrides,
})
const view = (state: RestoredRecycleOrderSnapshot) => renderToStaticMarkup(
  <RecycleOrderPanelView state={state} onQuote={vi.fn()} onConfirm={vi.fn()} onReject={vi.fn()} onPay={vi.fn()} onRetryUnknown={vi.fn()} onRefresh={vi.fn()} />,
)

describe('restored recycle order panel view', () => {
  it('shows the seller confirm path with fee breakdown for an active order', () => {
    const markup = view(snapshot())
    expect(markup).toContain('回收单 RC202601')
    expect(markup).toContain('待卖家确认')
    expect(markup).toContain('包赔费 ¥10.00')
    expect(markup).toContain('预计到手 ¥100.00')
    expect(markup).toContain('确认报价')
    expect(markup).toContain('拒绝')
  })

  it('shows the recycler pay path after confirmation and the completed state without actions', () => {
    const paying = view(snapshot({ role: 'recycler', order: snapshot().order && { ...snapshot().order!, status: 'pending_payment' } }))
    expect(paying).toContain('卖家已确认')
    expect(paying).toContain('支付 ¥110.00')
    expect(paying).not.toContain('确认报价')
    const done = view(snapshot({ order: { ...snapshot().order!, status: 'completed', paymentStatus: 'PAID' } }))
    expect(done).toContain('已完成')
    expect(done).toContain('已支付')
    expect(done).not.toContain('确认报价')
    expect(done).not.toContain('支付 ¥110.00')
  })

  it('keeps the quote form recycler-only and surfaces unknown with retry', () => {
    const noOrder = { loading: false, stale: false, error: null, order: null, canQuote: true, role: 'recycler' as const, busy: false, actionState: 'idle' as const, actionError: null, lastAction: null }
    expect(view(noOrder)).toContain('发起正式报价')
    const sellerWaiting = { ...noOrder, canQuote: false, role: 'seller' as const }
    expect(view(sellerWaiting)).not.toContain('发起正式报价')
    const unknown = { ...noOrder, actionState: 'unknown' as const, actionError: '操作结果尚未确认' }
    expect(view(unknown)).toContain('重试原操作')
    const failed = view(snapshot({ actionError: '回收单状态已变化，请刷新后重试' }))
    expect(failed).toContain('role="alert"')
  })
})
