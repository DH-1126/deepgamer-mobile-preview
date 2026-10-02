import { describe, expect, it, vi } from 'vitest'
import type { RestoredEnvelope } from './restoredLinkedTransport'
import { createRestoredOrderApi, parseRestoredOwnedOrder } from './restoredOrderApi'

const financials = {
  provenance: 'LOCAL_DEMO',
  amounts: { goodsAmountFen: 120_000, serviceFeeFen: 8_001, guaranteeFeeFen: 0, discountFen: 0, payableAmountFen: 128_001 },
  paidAmountFen: 128_001,
  refundedAmountFen: 0,
  pendingRefundAmountFen: 128_001,
} as const

function rawOrder(id = 'order-1', overrides: Record<string, unknown> = {}) {
  return {
    id, orderNo: `NO-${id}`, status: 'AFTER_SALE', statusLabel: '售后中', rowVersion: 3,
    goods: { goodsNo: 'GOODS-1', title: '合成账号', coverUrl: null, game: { code: 'wzry', name: '王者荣耀', iconUrl: null }, accountMasked: '***123', regionName: '微信区', serverName: '一区' },
    buyer: { userRef: 'buyer-1', displayName: '合成买家' }, seller: { userRef: 'seller-1', displayName: '合成卖家' }, viewRoles: ['BUYER'],
    amountFen: 128_001, paidAmountFen: 128_001, refundedAmountFen: 0, currency: 'CNY',
    payment: { paymentNo: null, paymentChannel: 'ALIPAY', goodsAmountFen: 120_000, serviceFeeFen: 8_001, discountFen: 0, payableAmountFen: 128_001, paidAmountFen: 128_001, paidAt: '2026-09-28T04:00:00.000Z', refundAmountFen: 0, refundedAt: null },
    afterSaleEntryEnabled: true, createdAt: '2026-09-28T03:00:00.000Z', updatedAt: '2026-09-28T04:10:00.000Z', paidAt: '2026-09-28T04:00:00.000Z', completedAt: null, cancelledAt: null,
    provenance: 'LOCAL_DEMO', trade: null, financials, ...overrides,
  }
}

describe('restored owned order API', () => {
  it('parses frozen local financial facts without merging paid, pending refund, and refunded amounts', () => {
    expect(parseRestoredOwnedOrder(rawOrder()).financials).toEqual(financials)
  })

  it('keeps historical unverified amounts and pending refund unknown instead of inventing zero', () => {
    const order = parseRestoredOwnedOrder(rawOrder('history-1', {
      provenance: 'UNVERIFIED',
      financials: { provenance: 'UNVERIFIED', amounts: null, paidAmountFen: 25_000, refundedAmountFen: 5_000, pendingRefundAmountFen: null },
    }))
    expect(order.financials).toEqual({ provenance: 'UNVERIFIED', amounts: null, paidAmountFen: 25_000, refundedAmountFen: 5_000, pendingRefundAmountFen: null })
  })

  it('normalizes a legacy response without financials to explicit unavailable facts', () => {
    const legacy = rawOrder('legacy-1')
    delete (legacy as { financials?: unknown }).financials
    expect(parseRestoredOwnedOrder(legacy).financials).toBeNull()
  })

  it('rejects an internal payment receipt instead of exposing or depending on it', () => {
    const leaked = rawOrder('receipt-leak')
    ;(leaked.payment as { paymentNo: unknown }).paymentNo = 'INTERNAL-RECEIPT'
    expect(() => parseRestoredOwnedOrder(leaked)).toThrow(/本人订单数据不符合契约/)
  })

  it('does not apply the new frozen-financial identity rule to the separate legacy trade snapshot', () => {
    const trade = {
      quoteId: 'quote-1', packageId: 'STANDARD', pricingVersion: null,
      amounts: { goodsAmountFen: 100, serviceFeeFen: 20, guaranteeFeeFen: 0, discountFen: 0, payableAmountFen: 100 },
      guaranteeIntent: { intentId: null, status: 'NOT_APPLICABLE' }, allocationStatus: 'UNALLOCATED', refundAmountFen: 0,
    }
    expect(parseRestoredOwnedOrder(rawOrder('legacy-trade', { trade })).trade).toEqual(trade)
  })

  it.each([
    ['negative paid amount', { financials: { ...financials, paidAmountFen: -1 } }],
    ['negative frozen amount', { financials: { ...financials, amounts: { ...financials.amounts, guaranteeFeeFen: -1 } } }],
    ['inconsistent frozen payable amount', { financials: { ...financials, amounts: { ...financials.amounts, payableAmountFen: 128_000 } } }],
    ['overflowing frozen amount identity', { financials: { ...financials, amounts: { ...financials.amounts, goodsAmountFen: Number.MAX_SAFE_INTEGER } } }],
    ['invalid original status', { status: 'CLOSED' }],
    ['unverified invented pending refund', { provenance: 'UNVERIFIED', financials: { provenance: 'UNVERIFIED', amounts: null, paidAmountFen: 0, refundedAmountFen: 0, pendingRefundAmountFen: 0 } }],
  ])('rejects %s', (_case, override) => {
    expect(() => parseRestoredOwnedOrder(rawOrder('invalid-1', override))).toThrow(/本人订单数据不符合契约/)
  })

  it('loads every page with the exact requested ownership view and rejects cross-view rows', async () => {
    const paths: string[] = []
    const transport = {
      async read<T>(path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        paths.push(path)
        const page = Number(new URL(`http://test${path}`).searchParams.get('page'))
        const rows = page === 1 ? Array.from({ length: 50 }, (_, index) => rawOrder(`buy-${index + 1}`)) : [rawOrder('buy-51')]
        return { data: parse(rows), meta: { page, pageSize: 50, total: 51 } }
      },
    }
    const api = createRestoredOrderApi(transport as never)
    const orders = await api.listAll('buy')
    expect({ count: orders.length, first: orders[0].id, last: orders[50].id }).toEqual({ count: 51, first: 'buy-1', last: 'buy-51' })
    expect(paths).toEqual(['/client/orders?view=buy&page=1&pageSize=50', '/client/orders?view=buy&page=2&pageSize=50'])

    const wrongView = { read: vi.fn(async <T>(_path: string, parse: (value: unknown) => T) => ({ data: parse([rawOrder('seller-only', { viewRoles: ['SELLER'] })]), meta: { page: 1, pageSize: 50, total: 1 } })) }
    await expect(createRestoredOrderApi(wrongView as never).listAll('buy')).rejects.toThrow(/订单视角不符合/)
  })

  it('reads order detail from the owned detail endpoint with the same parser', async () => {
    const read = vi.fn(async <T>(_path: string, parse: (value: unknown) => T) => ({ data: parse(rawOrder('order-safe_1')) }))
    const result = await createRestoredOrderApi({ read } as never).read('order-safe_1')
    expect(read.mock.calls[0][0]).toBe('/client/orders/order-safe_1')
    expect(result).toMatchObject({ id: 'order-safe_1', status: 'AFTER_SALE', financials: { pendingRefundAmountFen: 128_001, refundedAmountFen: 0 } })
  })

  it('fails closed when the owned detail response belongs to a different route id', async () => {
    const read = vi.fn(async <T>(_path: string, parse: (value: unknown) => T) => ({ data: parse(rawOrder('order-other')) }))
    await expect(createRestoredOrderApi({ read } as never).read('order-requested')).rejects.toThrow(/订单标识不匹配/)
  })
})
