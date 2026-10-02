import { describe, expect, it, vi } from 'vitest'
import type { RestoredEnvelope } from './restoredLinkedTransport'
import {
  createRestoredPurchaseApi,
  parseRestoredPaymentContext,
  parseRestoredPublicGoods,
  parseRestoredQuote,
} from './restoredPurchaseApi'

const quote = {
  quoteId: 'quote-1', quoteVersion: 1, expiresAt: '2026-09-28T12:00:00.000Z', goodsId: 'goods-1', goodsVersion: 3, currency: 'CNY',
  packageSnapshot: { packageId: 'STANDARD', label: '普通交易', pricingVersion: 'standard-v1' },
  amounts: { goodsAmountFen: 120_000, serviceFeeFen: 8_001, guaranteeFeeFen: 0, discountFen: 1_000, payableAmountFen: 127_001 },
  purchasable: true, blockedReason: null,
} as const

function goods(id = 'goods-1') {
  return {
    id, goodsNo: `NO-${id}`, title: '合成已审核商品', priceFen: 120_000, currency: 'CNY', description: '仅用于本地测试', coverUrl: null,
    images: ['/api/v1/client/catalog/media/image-1'], game: { id: 'game-1', code: 'wzry', name: '王者荣耀' },
    seller: { sellerRef: 'seller-1', displayName: '合成卖家' },
    attributes: [{ refType: 'ATTRIBUTE', refKey: 'rank', valueType: 'ENUM', value: 'king', configVersionId: 'config-1' }],
    contentRevision: 3, rowVersion: 4, snapshotId: 'snapshot-1', schemaHash: 'a'.repeat(64), productStatus: 'ON_SALE', auditStatus: 'APPROVED', locked: false,
    createdAt: '2026-09-28T08:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z',
  }
}

describe('restored purchase API', () => {
  it('strictly parses public approved goods and rejects omitted or private fields', () => {
    expect(parseRestoredPublicGoods(goods())).toMatchObject({ id: 'goods-1', priceFen: 120_000, auditStatus: 'APPROVED' })
    const missing = goods() as Record<string, unknown>; delete missing.snapshotId
    expect(() => parseRestoredPublicGoods(missing)).toThrow(/公开商品数据不符合契约/)
    expect(() => parseRestoredPublicGoods({ ...goods(), buyerMobile: '13800000000' })).toThrow(/公开商品数据不符合契约/)
  })

  it('rejects a quote whose five monetary facts do not add up', () => {
    expect(parseRestoredQuote(quote).amounts.payableAmountFen).toBe(127_001)
    expect(() => parseRestoredQuote({ ...quote, amounts: { ...quote.amounts, payableAmountFen: 127_000 } })).toThrow(/报价数据不符合契约/)
  })

  it('accepts only the safe payment operation whitelist and never a receipt', () => {
    const context = {
      orderId: 'order-1', rowVersion: 2, canStartPayment: false, blockedReason: '存在待确认的模拟支付',
      operation: { operationId: 'operation-1', orderId: 'order-1', amountFen: 127_001, currency: 'CNY', status: 'UNKNOWN', createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z' },
    }
    expect(parseRestoredPaymentContext(context).operation?.status).toBe('UNKNOWN')
    expect(() => parseRestoredPaymentContext({ ...context, operation: { ...context.operation, receiptRef: 'private-receipt' } })).toThrow(/支付上下文不符合契约/)
    expect(() => parseRestoredPaymentContext({ ...context, blockedReason: '' })).toThrow(/支付上下文不符合契约/)
    expect(() => parseRestoredPaymentContext({ ...context, operation: { ...context.operation, createdAt: 'not-a-datetime' } })).toThrow(/支付上下文不符合契约/)
  })

  it('collects every public goods page without duplicates or truncation', async () => {
    const paths: string[] = []
    const transport = {
      async read<T>(path: string, parse: (value: unknown) => T): Promise<RestoredEnvelope<T>> {
        paths.push(path)
        const page = Number(new URL(`http://test${path}`).searchParams.get('page'))
        const value = page === 1 ? Array.from({ length: 50 }, (_, index) => goods(`goods-${index + 1}`)) : [goods('goods-51')]
        return { data: parse(value), meta: { page, pageSize: 50, total: 51 } }
      },
      write: vi.fn(),
    }
    const result = await createRestoredPurchaseApi(transport as never).listPublicGoods()
    expect(result.map(item => item.id)).toHaveLength(51)
    expect(paths).toEqual(['/client/catalog/goods?page=1&pageSize=50', '/client/catalog/goods?page=2&pageSize=50'])
  })

  it('uses the frozen quote and operation identifiers for all writes and recovery reads', async () => {
    const read = vi.fn(async <T>(path: string, parse: (value: unknown) => T) => {
      const value = path === '/client/quotes/quote-1'
        ? { quote, orderId: null }
        : { orderId: 'order-1', rowVersion: 2, canStartPayment: true, blockedReason: null, operation: null }
      return { data: parse(value) }
    })
    const write = vi.fn(async <T>(path: string, _body: unknown, _key: string, parse: (value: unknown) => T) => ({
      data: parse(path === '/client/quotes' ? quote : {
        order: { id: 'order-1', status: path.endsWith('/pay') ? 'DELIVERING' : 'PENDING_PAYMENT', rowVersion: path.endsWith('/pay') ? 2 : 1 },
        operation: path.endsWith('/pay') ? { operationId: 'operation-1', orderId: 'order-1', amountFen: 127_001, currency: 'CNY', status: 'SUCCEEDED', createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:01.000Z', receiptRef: 'must-not-escape' } : null,
      }),
    }))
    const api = createRestoredPurchaseApi({ read, write } as never)
    await api.createQuote('goods-1', 'STANDARD', 'quote-key-123')
    await api.recoverQuote('quote-1')
    await api.createOrder('quote-1', 'create-key-123')
    await api.readPaymentContext('order-1')
    const paid = await api.submitPayment('order-1', { rowVersion: 2, operationId: 'operation-1', simulatedResult: 'SUCCESS', simulatedReceiptRef: 'LOCAL-DEMO-operation-1' }, 'pay-key-123')
    expect(write.mock.calls.map(call => [call[0], call[1], call[2]])).toEqual([
      ['/client/quotes', { goodsId: 'goods-1', packageId: 'STANDARD' }, 'quote-key-123'],
      ['/client/orders', { quoteId: 'quote-1' }, 'create-key-123'],
      ['/client/orders/order-1/pay', { rowVersion: 2, channel: 'WECHAT', operationId: 'operation-1', simulatedResult: 'SUCCESS', simulatedReceiptRef: 'LOCAL-DEMO-operation-1' }, 'pay-key-123'],
    ])
    expect(read.mock.calls.map(call => call[0])).toEqual(['/client/quotes/quote-1', '/client/orders/order-1/payment-context'])
    expect(paid.operation).toEqual({ operationId: 'operation-1', orderId: 'order-1', amountFen: 127_001, currency: 'CNY', status: 'SUCCEEDED', createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:01.000Z' })
    expect(paid).not.toHaveProperty('receiptRef')
  })
})
