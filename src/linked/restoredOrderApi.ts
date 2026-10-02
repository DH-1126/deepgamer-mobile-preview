import { collectRestoredPages, type createRestoredLinkedTransport } from './restoredLinkedTransport'

type Transport = ReturnType<typeof createRestoredLinkedTransport>
type RecordValue = Record<string, unknown>

export type RestoredOrderView = 'buy' | 'sell'
export type RestoredOrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'DELIVERING' | 'WAITING_CONFIRM' | 'COMPLETED' | 'CANCELLED' | 'AFTER_SALE' | 'REFUNDED'
export type RestoredOrderProvenance = 'LOCAL_DEMO' | 'UNVERIFIED'
export type RestoredOrderAmounts = {
  goodsAmountFen: number
  serviceFeeFen: number
  guaranteeFeeFen: number
  discountFen: number
  payableAmountFen: number
}
export type RestoredOrderFinancials = {
  provenance: RestoredOrderProvenance
  amounts: RestoredOrderAmounts | null
  paidAmountFen: number
  refundedAmountFen: number
  pendingRefundAmountFen: number | null
}
export type RestoredOrderTradeSnapshot = {
  quoteId: string
  packageId: 'STANDARD' | 'PREMIUM'
  pricingVersion: string | null
  amounts: RestoredOrderAmounts
  guaranteeIntent: { intentId: string | null; status: 'NOT_APPLICABLE' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN' | 'CANCELLED' }
  allocationStatus: 'UNALLOCATED' | 'ALLOCATED' | 'REFUND_REQUIRED'
  refundAmountFen: number
}

export type RestoredOwnedOrder = {
  id: string
  orderNo: string
  status: RestoredOrderStatus
  statusLabel: string
  rowVersion: number
  goods: {
    goodsNo: string
    title: string
    coverUrl: string | null
    game: { code: string; name: string; iconUrl: string | null }
    accountMasked: string
    regionName: string
    serverName: string
  }
  buyer: { userRef: string; displayName: string }
  seller: { userRef: string; displayName: string }
  viewRoles: Array<'BUYER' | 'SELLER'>
  amountFen: number
  paidAmountFen: number
  refundedAmountFen: number
  currency: 'CNY'
  payment: {
    paymentNo: null
    paymentChannel: 'WECHAT' | 'ALIPAY' | 'BALANCE' | 'MIXED' | null
    goodsAmountFen: number
    serviceFeeFen: number
    discountFen: number
    payableAmountFen: number
    paidAmountFen: number
    paidAt: string | null
    refundAmountFen: number
    refundedAt: string | null
  }
  afterSaleEntryEnabled: boolean
  createdAt: string
  updatedAt: string
  paidAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  provenance: RestoredOrderProvenance
  trade: RestoredOrderTradeSnapshot | null
  financials: RestoredOrderFinancials | null
}

const statuses: RestoredOrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'DELIVERING', 'WAITING_CONFIRM', 'COMPLETED', 'CANCELLED', 'AFTER_SALE', 'REFUNDED']

function invalidOrder(): never { throw new Error('本人订单数据不符合契约') }
function object(value: unknown): RecordValue | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null }
function exact(row: RecordValue, keys: readonly string[]) { if (Object.keys(row).some(key => !keys.includes(key))) invalidOrder() }
function text(value: unknown): value is string { return typeof value === 'string' }
function nullableText(value: unknown): value is string | null { return value === null || text(value) }
function positive(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 }
function amount(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }

function parseAmounts(value: unknown, requireFrozenIdentity = false): RestoredOrderAmounts {
  const row = object(value)
  if (!row) invalidOrder()
  exact(row, ['goodsAmountFen', 'serviceFeeFen', 'guaranteeFeeFen', 'discountFen', 'payableAmountFen'])
  if (!amount(row.goodsAmountFen) || !amount(row.serviceFeeFen) || !amount(row.guaranteeFeeFen) || !amount(row.discountFen) || !amount(row.payableAmountFen)) invalidOrder()
  if (requireFrozenIdentity) {
    const expected = row.goodsAmountFen + row.serviceFeeFen + row.guaranteeFeeFen - row.discountFen
    if (!Number.isSafeInteger(expected) || expected !== row.payableAmountFen) invalidOrder()
  }
  return { goodsAmountFen: row.goodsAmountFen, serviceFeeFen: row.serviceFeeFen, guaranteeFeeFen: row.guaranteeFeeFen, discountFen: row.discountFen, payableAmountFen: row.payableAmountFen }
}

function parseFinancials(value: unknown, provenance: RestoredOrderProvenance): RestoredOrderFinancials {
  const row = object(value)
  if (!row) invalidOrder()
  exact(row, ['provenance', 'amounts', 'paidAmountFen', 'refundedAmountFen', 'pendingRefundAmountFen'])
  if ((row.provenance !== 'LOCAL_DEMO' && row.provenance !== 'UNVERIFIED') || row.provenance !== provenance
    || !amount(row.paidAmountFen) || !amount(row.refundedAmountFen)
    || !(row.pendingRefundAmountFen === null || amount(row.pendingRefundAmountFen))) invalidOrder()
  if (row.provenance === 'UNVERIFIED') {
    if (row.amounts !== null || row.pendingRefundAmountFen !== null) invalidOrder()
    return { provenance: 'UNVERIFIED', amounts: null, paidAmountFen: row.paidAmountFen, refundedAmountFen: row.refundedAmountFen, pendingRefundAmountFen: null }
  }
  if (row.amounts === null || row.pendingRefundAmountFen === null) invalidOrder()
  return { provenance: 'LOCAL_DEMO', amounts: parseAmounts(row.amounts, true), paidAmountFen: row.paidAmountFen, refundedAmountFen: row.refundedAmountFen, pendingRefundAmountFen: row.pendingRefundAmountFen }
}

function parseParty(value: unknown) {
  const row = object(value)
  if (!row) invalidOrder()
  exact(row, ['userRef', 'displayName'])
  if (!text(row.userRef) || !text(row.displayName)) invalidOrder()
  return { userRef: row.userRef, displayName: row.displayName }
}

function parseTrade(value: unknown): RestoredOrderTradeSnapshot {
  const row = object(value), guarantee = object(row?.guaranteeIntent)
  if (!row || !guarantee) invalidOrder()
  exact(row, ['quoteId', 'packageId', 'pricingVersion', 'amounts', 'guaranteeIntent', 'allocationStatus', 'refundAmountFen'])
  exact(guarantee, ['intentId', 'status'])
  if (!text(row.quoteId) || !['STANDARD', 'PREMIUM'].includes(String(row.packageId)) || !nullableText(row.pricingVersion)
    || !nullableText(guarantee.intentId) || !['NOT_APPLICABLE', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'UNKNOWN', 'CANCELLED'].includes(String(guarantee.status))
    || !['UNALLOCATED', 'ALLOCATED', 'REFUND_REQUIRED'].includes(String(row.allocationStatus)) || !amount(row.refundAmountFen)) invalidOrder()
  return {
    quoteId: row.quoteId, packageId: row.packageId as RestoredOrderTradeSnapshot['packageId'], pricingVersion: row.pricingVersion,
    amounts: parseAmounts(row.amounts), guaranteeIntent: { intentId: guarantee.intentId, status: guarantee.status as RestoredOrderTradeSnapshot['guaranteeIntent']['status'] },
    allocationStatus: row.allocationStatus as RestoredOrderTradeSnapshot['allocationStatus'], refundAmountFen: row.refundAmountFen,
  }
}

export function parseRestoredOwnedOrder(value: unknown): RestoredOwnedOrder {
  const row = object(value), goods = object(row?.goods), game = object(goods?.game), payment = object(row?.payment)
  if (!row || !goods || !game || !payment) invalidOrder()
  exact(row, ['id', 'orderNo', 'status', 'statusLabel', 'rowVersion', 'goods', 'buyer', 'seller', 'viewRoles', 'amountFen', 'paidAmountFen', 'refundedAmountFen', 'currency', 'payment', 'afterSaleEntryEnabled', 'createdAt', 'updatedAt', 'paidAt', 'completedAt', 'cancelledAt', 'provenance', 'trade', 'financials'])
  exact(goods, ['goodsNo', 'title', 'coverUrl', 'game', 'accountMasked', 'regionName', 'serverName'])
  exact(game, ['code', 'name', 'iconUrl'])
  exact(payment, ['paymentNo', 'paymentChannel', 'goodsAmountFen', 'serviceFeeFen', 'discountFen', 'payableAmountFen', 'paidAmountFen', 'paidAt', 'refundAmountFen', 'refundedAt'])
  if (!text(row.id) || !text(row.orderNo) || !statuses.includes(row.status as RestoredOrderStatus) || !text(row.statusLabel) || !positive(row.rowVersion)
    || !text(goods.goodsNo) || !text(goods.title) || !nullableText(goods.coverUrl) || !text(game.code) || !text(game.name) || !nullableText(game.iconUrl)
    || !text(goods.accountMasked) || !text(goods.regionName) || !text(goods.serverName) || !Array.isArray(row.viewRoles) || row.viewRoles.length === 0
    || row.viewRoles.some(role => role !== 'BUYER' && role !== 'SELLER') || !amount(row.amountFen) || !amount(row.paidAmountFen) || !amount(row.refundedAmountFen)
    || row.currency !== 'CNY' || payment.paymentNo !== null || !(payment.paymentChannel === null || ['WECHAT', 'ALIPAY', 'BALANCE', 'MIXED'].includes(String(payment.paymentChannel)))
    || !amount(payment.goodsAmountFen) || !amount(payment.serviceFeeFen) || !amount(payment.discountFen) || !amount(payment.payableAmountFen) || !amount(payment.paidAmountFen)
    || !nullableText(payment.paidAt) || !amount(payment.refundAmountFen) || !nullableText(payment.refundedAt) || typeof row.afterSaleEntryEnabled !== 'boolean'
    || !text(row.createdAt) || !text(row.updatedAt) || !nullableText(row.paidAt) || !nullableText(row.completedAt) || !nullableText(row.cancelledAt)
    || (row.provenance !== 'LOCAL_DEMO' && row.provenance !== 'UNVERIFIED') || !(row.trade === null || object(row.trade))) invalidOrder()
  const provenance = row.provenance as RestoredOrderProvenance
  return {
    id: row.id, orderNo: row.orderNo, status: row.status as RestoredOrderStatus, statusLabel: row.statusLabel, rowVersion: row.rowVersion,
    goods: { goodsNo: goods.goodsNo, title: goods.title, coverUrl: goods.coverUrl, game: { code: game.code, name: game.name, iconUrl: game.iconUrl }, accountMasked: goods.accountMasked, regionName: goods.regionName, serverName: goods.serverName },
    buyer: parseParty(row.buyer), seller: parseParty(row.seller), viewRoles: row.viewRoles as RestoredOwnedOrder['viewRoles'],
    amountFen: row.amountFen, paidAmountFen: row.paidAmountFen, refundedAmountFen: row.refundedAmountFen, currency: 'CNY',
    payment: {
      paymentNo: payment.paymentNo, paymentChannel: payment.paymentChannel as RestoredOwnedOrder['payment']['paymentChannel'], goodsAmountFen: payment.goodsAmountFen,
      serviceFeeFen: payment.serviceFeeFen, discountFen: payment.discountFen, payableAmountFen: payment.payableAmountFen, paidAmountFen: payment.paidAmountFen,
      paidAt: payment.paidAt, refundAmountFen: payment.refundAmountFen, refundedAt: payment.refundedAt,
    },
    afterSaleEntryEnabled: row.afterSaleEntryEnabled, createdAt: row.createdAt, updatedAt: row.updatedAt, paidAt: row.paidAt, completedAt: row.completedAt, cancelledAt: row.cancelledAt,
    provenance, trade: row.trade === null ? null : parseTrade(row.trade), financials: Object.hasOwn(row, 'financials') ? parseFinancials(row.financials, provenance) : null,
  }
}

function parseOrders(value: unknown): RestoredOwnedOrder[] {
  if (!Array.isArray(value)) invalidOrder()
  return value.map(parseRestoredOwnedOrder)
}

function segment(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/u.test(value)) throw new Error('订单标识格式错误')
  return encodeURIComponent(value)
}

export function createRestoredOrderApi(transport: Pick<Transport, 'read'>) {
  return {
    async listAll(view: RestoredOrderView, signal?: AbortSignal): Promise<RestoredOwnedOrder[]> {
      const orders = await collectRestoredPages(
        (page, pageSignal) => transport.read(`/client/orders?view=${view}&page=${page}&pageSize=50`, parseOrders, pageSignal),
        order => order.id,
        signal,
      )
      const role = view === 'buy' ? 'BUYER' : 'SELLER'
      if (orders.some(order => !order.viewRoles.includes(role))) throw new Error('订单视角不符合当前主体')
      return orders
    },
    async read(orderId: string, signal?: AbortSignal): Promise<RestoredOwnedOrder> {
      const order = (await transport.read(`/client/orders/${segment(orderId)}`, parseRestoredOwnedOrder, signal)).data
      if (order.id !== orderId) throw new Error('订单标识不匹配')
      return order
    },
  }
}
