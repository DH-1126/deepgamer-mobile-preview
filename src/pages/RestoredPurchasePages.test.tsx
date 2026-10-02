import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { RestoredCheckoutSnapshot, RestoredPaymentSnapshot } from '../linked/restoredPurchaseController'
import type { RestoredPublicGoods } from '../linked/restoredPurchaseApi'
import { RestoredCatalogView, RestoredCheckoutView, RestoredPaymentView } from './RestoredPurchasePages'

const goods: RestoredPublicGoods = {
  id: 'harness-purchase-goods', goodsNo: 'GOODS-EXT', title: '合成外部卖家商品', priceFen: 120_000, currency: 'CNY', description: '本地验收商品', coverUrl: null, images: [],
  game: { id: 'game-1', code: 'wzry', name: '王者荣耀' }, seller: { sellerRef: 'external-seller', displayName: '合成外部卖家' }, attributes: [],
  contentRevision: 2, rowVersion: 3, snapshotId: 'snapshot-1', schemaHash: 'a'.repeat(64), productStatus: 'ON_SALE', auditStatus: 'APPROVED', locked: false,
  createdAt: '2026-09-28T08:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z',
}

const checkout: RestoredCheckoutSnapshot = {
  goodsId: goods.id, packageId: 'STANDARD', goods,
  quote: {
    quoteId: 'quote-1', quoteVersion: 1, expiresAt: '2099-09-28T12:00:00.000Z', goodsId: goods.id, goodsVersion: 3, currency: 'CNY',
    packageSnapshot: { packageId: 'STANDARD', label: '普通交易', pricingVersion: 'standard-v1' },
    amounts: { goodsAmountFen: 120_000, serviceFeeFen: 8_001, guaranteeFeeFen: 0, discountFen: 1_000, payableAmountFen: 127_001 },
    purchasable: true, blockedReason: null,
  },
  loading: false, submitting: false, createUnknown: false, error: null,
}

const payment: RestoredPaymentSnapshot = {
  orderId: 'order-1',
  order: {
    id: 'order-1', orderNo: 'ORDER-1', status: 'PENDING_PAYMENT', statusLabel: '待付款', rowVersion: 4,
    goods: { goodsNo: 'GOODS-EXT', title: goods.title, coverUrl: null, game: { code: 'wzry', name: '王者荣耀', iconUrl: null }, accountMasked: '***123', regionName: '微信区', serverName: '一区' },
    buyer: { userRef: 'buyer-1', displayName: '合成买家' }, seller: { userRef: 'external-seller', displayName: '合成外部卖家' }, viewRoles: ['BUYER'],
    amountFen: 127_001, paidAmountFen: 0, refundedAmountFen: 0, currency: 'CNY', payment: { paymentNo: null, paymentChannel: null, goodsAmountFen: 120_000, serviceFeeFen: 8_001, discountFen: 1_000, payableAmountFen: 127_001, paidAmountFen: 0, paidAt: null, refundAmountFen: 0, refundedAt: null },
    afterSaleEntryEnabled: false, createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z', paidAt: null, completedAt: null, cancelledAt: null,
    provenance: 'LOCAL_DEMO', trade: null, financials: { provenance: 'LOCAL_DEMO', amounts: checkout.quote!.amounts, paidAmountFen: 0, refundedAmountFen: 0, pendingRefundAmountFen: 0 },
  },
  context: { orderId: 'order-1', rowVersion: 4, canStartPayment: true, blockedReason: null, operation: null },
  pending: null, lastOperationStatus: null, loading: false, busy: false, error: null,
}

describe('restored purchase views', () => {
  it('renders the real public catalog with a URL-bound purchase entry and honest empty/error states', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/buy"><RestoredCatalogView snapshot={{ goods: [goods], loading: false, error: null }} onRetry={vi.fn()} /></StaticRouter>)
    expect(html).toContain('购买账号')
    expect(html).toContain('合成外部卖家商品')
    expect(html).toContain('href="/buy/confirm?goodsId=harness-purchase-goods&amp;package=STANDARD"')
    const empty = renderToStaticMarkup(<StaticRouter location="/buy"><RestoredCatalogView snapshot={{ goods: [], loading: false, error: null }} onRetry={vi.fn()} /></StaticRouter>)
    expect(empty).toContain('暂无可购买的已审核商品')
    const failed = renderToStaticMarkup(<StaticRouter location="/buy"><RestoredCatalogView snapshot={{ goods: [], loading: false, error: '目录失败' }} onRetry={vi.fn()} /></StaticRouter>)
    expect(failed).toContain('role="alert"')
    expect(failed).not.toContain('暂无可购买')
  })

  it('shows all five server-priced facts and blocks unconfigured PREMIUM without fallback pricing', () => {
    const standard = renderToStaticMarkup(<StaticRouter location="/"><RestoredCheckoutView snapshot={checkout} onPackageChange={vi.fn()} onSubmit={vi.fn()} onRetry={vi.fn()} onRetryCreate={vi.fn()} /></StaticRouter>)
    for (const label of ['商品金额', '服务费', '保障费', '优惠', '应付金额']) expect(standard).toContain(label)
    expect(standard).toContain('¥1,270.01')
    expect(standard).toContain('quote-1')
    expect(standard).toContain('aria-label="返回商品列表"')
    expect(standard).toContain('<span>返回</span>')
    const premium: RestoredCheckoutSnapshot = { ...checkout, packageId: 'PREMIUM', quote: { ...checkout.quote!, quoteId: 'quote-premium', packageSnapshot: { packageId: 'PREMIUM', label: '包赔保障', pricingVersion: null }, purchasable: false, blockedReason: 'PRICING_NOT_CONFIGURED' }, error: '包赔费率、适用范围与规则版本尚未配置' }
    const blocked = renderToStaticMarkup(<StaticRouter location="/"><RestoredCheckoutView snapshot={premium} onPackageChange={vi.fn()} onSubmit={vi.fn()} onRetry={vi.fn()} onRetryCreate={vi.fn()} /></StaticRouter>)
    expect(blocked).toContain('包赔费率、适用范围与规则版本尚未配置')
    expect(blocked).not.toContain('默认按普通交易')
    expect(blocked).toMatch(/<button[^>]*disabled[^>]*>创建待付款订单/)
  })

  it('labels payment as local simulation and keeps UNKNOWN/REFUND_REQUIRED distinct from unpaid/refunded', () => {
    const ready = renderToStaticMarkup(<StaticRouter location="/"><RestoredPaymentView snapshot={payment} onResult={vi.fn()} onCheckPending={vi.fn()} onRetryOriginal={vi.fn()} onResolveUnknown={vi.fn()} onRetry={vi.fn()} /></StaticRouter>)
    expect(ready).toContain('本地模拟支付')
    expect(ready).toContain('aria-label="返回订单"')
    expect(ready).toContain('模拟成功')
    expect(ready).toContain('模拟失败')
    expect(ready).toContain('模拟结果未知')
    const pending = { ...payment, pending: { operationId: 'operation-unknown', simulatedResult: 'UNKNOWN' as const, rowVersion: 4 }, lastOperationStatus: 'UNKNOWN' as const, context: { ...payment.context!, canStartPayment: false, blockedReason: '存在未决操作', operation: { operationId: 'operation-unknown', orderId: 'order-1', amountFen: 127_001, currency: 'CNY' as const, status: 'UNKNOWN' as const, createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z' } } }
    const unknown = renderToStaticMarkup(<StaticRouter location="/"><RestoredPaymentView snapshot={pending} onResult={vi.fn()} onCheckPending={vi.fn()} onRetryOriginal={vi.fn()} onResolveUnknown={vi.fn()} onRetry={vi.fn()} /></StaticRouter>)
    expect(unknown).toContain('不能假定未扣款')
    expect(unknown).toContain('查询原操作结果')
    expect(unknown).toContain('确认原操作模拟成功')
    const refund = renderToStaticMarkup(<StaticRouter location="/"><RestoredPaymentView snapshot={{ ...payment, lastOperationStatus: 'REFUND_REQUIRED', context: { ...payment.context!, canStartPayment: false, blockedReason: '待退款' } }} onResult={vi.fn()} onCheckPending={vi.fn()} onRetryOriginal={vi.fn()} onResolveUnknown={vi.fn()} onRetry={vi.fn()} /></StaticRouter>)
    expect(refund).toContain('待退款')
    expect(refund).toContain('不表示退款已到账')
  })
})
