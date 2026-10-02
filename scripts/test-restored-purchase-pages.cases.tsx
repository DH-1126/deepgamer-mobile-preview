import assert from 'node:assert/strict'
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { RestoredCheckoutSnapshot, RestoredPaymentSnapshot } from '../src/linked/restoredPurchaseController'
import { RestoredHttpError } from '../src/linked/restoredLinkedTransport'
import { RestoredCheckoutRoute, RestoredCheckoutView, RestoredPaymentView } from '../src/pages/RestoredPurchasePages'

const quote = {
  quoteId: 'quote-1', quoteVersion: 1, expiresAt: '2099-09-28T12:00:00.000Z', goodsId: 'harness-purchase-goods', goodsVersion: 3, currency: 'CNY' as const,
  packageSnapshot: { packageId: 'STANDARD' as const, label: '普通交易', pricingVersion: 'standard-v1' },
  amounts: { goodsAmountFen: 120_000, serviceFeeFen: 8_001, guaranteeFeeFen: 0, discountFen: 1_000, payableAmountFen: 127_001 }, purchasable: true, blockedReason: null,
}
const goods = { id: 'harness-purchase-goods', goodsNo: 'GOODS-EXT', title: '合成外部卖家商品', priceFen: 120_000, currency: 'CNY' as const, description: '本地验收', coverUrl: null, images: [], game: { id: 'game-1', code: 'wzry', name: '王者荣耀' }, seller: { sellerRef: 'external-seller', displayName: '外部卖家' }, attributes: [], contentRevision: 2, rowVersion: 3, snapshotId: 'snapshot-1', schemaHash: 'a'.repeat(64), productStatus: 'ON_SALE' as const, auditStatus: 'APPROVED' as const, locked: false, createdAt: '2026-09-28T08:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z' }
const checkout: RestoredCheckoutSnapshot = { goodsId: goods.id, packageId: 'STANDARD', goods, quote, loading: false, submitting: false, createUnknown: false, error: null }
const order = { id: 'order-1', orderNo: 'ORDER-1', status: 'PENDING_PAYMENT' as const, statusLabel: '待付款', rowVersion: 4, goods: { goodsNo: 'GOODS-EXT', title: goods.title, coverUrl: null, game: { code: 'wzry', name: '王者荣耀', iconUrl: null }, accountMasked: '***123', regionName: '微信区', serverName: '一区' }, buyer: { userRef: 'buyer-1', displayName: '合成买家' }, seller: { userRef: 'external-seller', displayName: '外部卖家' }, viewRoles: ['BUYER' as const], amountFen: 127_001, paidAmountFen: 0, refundedAmountFen: 0, currency: 'CNY' as const, payment: { paymentNo: null, paymentChannel: null, goodsAmountFen: 120_000, serviceFeeFen: 8_001, discountFen: 1_000, payableAmountFen: 127_001, paidAmountFen: 0, paidAt: null, refundAmountFen: 0, refundedAt: null }, afterSaleEntryEnabled: false, createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z', paidAt: null, completedAt: null, cancelledAt: null, provenance: 'LOCAL_DEMO' as const, trade: null, financials: { provenance: 'LOCAL_DEMO' as const, amounts: quote.amounts, paidAmountFen: 0, refundedAmountFen: 0, pendingRefundAmountFen: 0 } }

function button(label: string) {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label)
  if (!found) throw new Error(`未找到按钮：${label}`)
  return found
}

async function settle() {
  await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 0)); await Promise.resolve() })
}

function LocationProbe() {
  const location = useLocation()
  return <output data-location="true">{location.pathname}{location.search}</output>
}

export async function runRestoredPurchasePagesCases() {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  let packageSelection = ''
  let checked = 0
  let resolved = ''
  try {
    await act(async () => root.render(<MemoryRouter key="checkout-view" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><RestoredCheckoutView snapshot={checkout} onPackageChange={value => { packageSelection = value }} onSubmit={() => undefined} onRetry={() => undefined} onRetryCreate={() => undefined} /></MemoryRouter>))
    await act(async () => button('包赔保障').click())
    assert.equal(packageSelection, 'PREMIUM', '实际挂载页面应响应保障方案切换')

    function PaymentHarness() {
      const [snapshot] = useState<RestoredPaymentSnapshot>({
        orderId: 'order-1', order,
        context: { orderId: 'order-1', rowVersion: 4, canStartPayment: false, blockedReason: '存在未决操作', operation: { operationId: 'operation-unknown', orderId: 'order-1', amountFen: 127_001, currency: 'CNY', status: 'UNKNOWN', createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z' } },
        pending: { operationId: 'operation-unknown', simulatedResult: 'UNKNOWN', rowVersion: 4 }, lastOperationStatus: 'UNKNOWN', loading: false, busy: false, error: null,
      })
      return <RestoredPaymentView snapshot={snapshot} onResult={() => undefined} onCheckPending={() => { checked += 1 }} onRetryOriginal={() => undefined} onResolveUnknown={value => { resolved = value }} onRetry={() => undefined} />
    }
    await act(async () => root.render(<MemoryRouter key="payment-view" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PaymentHarness /></MemoryRouter>))
    const pendingPanel = document.querySelector<HTMLElement>('[data-restored-payment-pending="true"]')
    assert.ok(pendingPanel, '未知结果应显示原操作恢复面板')
    assert.equal(document.activeElement, pendingPanel, '未知结果面板出现后应获得焦点')
    await act(async () => button('查询原操作结果').click())
    await act(async () => button('确认原操作模拟成功').click())
    assert.equal(checked, 1)
    assert.equal(resolved, 'SUCCESS')

    let quoteCalls = 0
    let recoveryReads = 0
    const createKeys: string[] = []
    const routeApi = {
      readPublicGoods: async () => goods,
      createQuote: async (_goodsId: string, packageId: 'STANDARD' | 'PREMIUM') => {
        quoteCalls += 1
        return { ...quote, quoteId: `quote-${packageId.toLowerCase()}`, packageSnapshot: { packageId, label: packageId === 'STANDARD' ? '普通交易' : '包赔保障', pricingVersion: `${packageId.toLowerCase()}-v1` } }
      },
      recoverQuote: async (quoteId: string) => { recoveryReads += 1; return { quote: { ...quote, quoteId }, orderId: null } },
      createOrder: async (_quoteId: string, key: string) => {
        createKeys.push(key)
        if (createKeys.length === 1) throw new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', '结果未知', 'UNKNOWN')
        return { order: { id: 'order-1', status: 'PENDING_PAYMENT', rowVersion: 1 }, operation: null }
      },
    }
    await act(async () => root.render(<MemoryRouter key="checkout-route" future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/buy/confirm?goodsId=harness-purchase-goods&package=STANDARD']}><Routes><Route path="/buy/confirm" element={<><RestoredCheckoutRoute api={routeApi} /><LocationProbe /></>} /><Route path="/orders/:orderId/payment" element={<LocationProbe />} /></Routes></MemoryRouter>))
    await settle()
    assert.equal(quoteCalls, 1, '报价写入 URL 后不应 stop/start 再报价')
    assert.equal(recoveryReads, 0, '页面内写入 quoteId 不应被当成硬刷新恢复')
    assert.match(document.querySelector('[data-location="true"]')?.textContent ?? '', /quoteId=quote-standard/)
    assert.match(document.querySelector('[data-location="true"]')?.textContent ?? '', /createKey=purchase-create-/, '提交前恢复 URL 应固定非敏感创建键')
    await act(async () => button('包赔保障').click()); await settle()
    assert.equal(quoteCalls, 2, '切换方案只请求一次新报价')
    assert.match(document.querySelector('[data-location="true"]')?.textContent ?? '', /package=PREMIUM/)
    await act(async () => button('普通交易').click()); await settle()
    assert.equal(quoteCalls, 3)
    await act(async () => button('创建待付款订单').click()); await settle()
    assert.equal(createKeys.length, 1)
    assert.equal(button('包赔保障').disabled, true, '下单结果未知时必须冻结方案')
    await act(async () => button('包赔保障').click()); await settle()
    assert.equal(quoteCalls, 3, '下单结果未知时不能绕过原报价')
    await act(async () => button('用原报价与原固定键重试').click()); await settle()
    assert.equal(createKeys.length, 2)
    assert.equal(createKeys[1], createKeys[0], '结果未知只能重试原固定键')
    return { cases: 3, assertions: 18 }
  } finally {
    await act(async () => root.unmount()); host.remove()
  }
}
