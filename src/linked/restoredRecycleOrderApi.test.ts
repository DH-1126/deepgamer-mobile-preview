import { describe, expect, it, vi } from 'vitest'
import { createRestoredRecycleOrderApi } from './restoredRecycleOrderApi'

const rawOrder = {
  recycle_order_id: 'recycle-order-1', recycle_order_no: 'RC202601', status: 'active', recycle_consultation_id: 'consult-1',
  seller_management_id: 'seller-1', seller_name: '测试卖家', recycler_id: 'shop-1', recycler_name: '测试回收商',
  login_account: 'player_001', quote_amount: 10000, buyer_pay_amount: 11000, seller_receivable_amount: 10000,
  trade_order_payment_status: null, valid_until: Date.now() + 60_000, description: '',
  fee_snapshot: { quote_amount: 10000, guarantee_fee_amount: 1000, guarantee_fee_rate: '0.1', seller_receivable_amount: 10000, buyer_pay_amount: 11000, currency: 'CNY' },
}

describe('restored recycle order api', () => {
  it('unwraps the { order } result envelope exactly once', async () => {
    const read = vi.fn(async (_path: string, parse: (value: unknown) => unknown) => ({ data: parse({ order: rawOrder }) }))
    const write = vi.fn(async (_path: string, _body: unknown, _key: string, parse: (value: unknown) => unknown) => ({ data: parse({ order: rawOrder }) }))
    const api = createRestoredRecycleOrderApi({ read: read as never, write: write as never })
    const readOrder = await api.readOrder('consult-1')
    expect(readOrder).toMatchObject({ recycleOrderId: 'recycle-order-1', quoteAmountFen: 10000, guaranteeFeeAmountFen: 1000, paymentStatus: null })
    const quoted = await api.createQuote('consult-1', { quoteAmountFen: 10000, loginAccount: 'player_001' }, 'api-key-0001')
    expect(quoted.recycleOrderId).toBe('recycle-order-1')
    expect(read.mock.calls[0][1]).toBeTypeOf('function')
    expect(write.mock.calls[0][3]).toBeTypeOf('function')
  })
})
