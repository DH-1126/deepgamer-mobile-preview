import { RestoredHttpError, type createRestoredLinkedTransport } from './restoredLinkedTransport'

/** W04-B：咨询绑定回收单的客户端 API（详情 + 报价/确认/拒绝/支付）。 */

export type RestoredRecycleOrder = {
  recycleOrderId: string
  recycleOrderNo: string
  status: string
  recycleConsultationId: string
  sellerManagementId: string
  sellerName: string
  recyclerId: string
  recyclerName: string
  loginAccount: string
  quoteAmountFen: number
  guaranteeFeeAmountFen: number
  guaranteeFeeRate: string
  sellerReceivableAmountFen: number
  buyerPayAmountFen: number
  paymentStatus: string | null
  description: string
  validUntil: number | null
}

export type RestoredRecycleOrderApi = {
  readOrder(consultationId: string, signal?: AbortSignal): Promise<RestoredRecycleOrder>
  createQuote(consultationId: string, body: { quoteAmountFen: number; loginAccount: string; description?: string }, key: string, signal?: AbortSignal): Promise<RestoredRecycleOrder>
  confirmOrder(consultationId: string, expectedStatus: string, key: string, signal?: AbortSignal): Promise<RestoredRecycleOrder>
  rejectOrder(consultationId: string, expectedStatus: string, reason: string, key: string, signal?: AbortSignal): Promise<RestoredRecycleOrder>
  payOrder(consultationId: string, expectedStatus: string, key: string, signal?: AbortSignal): Promise<RestoredRecycleOrder>
}

type Row = Record<string, unknown>

function fail(): never {
  throw new RestoredHttpError(0, 'CLIENT_RECYCLE_ORDER_RESPONSE_INVALID', '回收单数据不符合已确认契约')
}

const object = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null
const nonempty = (value: unknown, max = 200): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function parseOrder(input: unknown): RestoredRecycleOrder {
  const row = object(input)
  if (!row || !nonempty(row.recycle_order_id) || !nonempty(row.recycle_order_no) || !nonempty(row.status)
    || !nonempty(row.recycle_consultation_id) || !nonempty(row.seller_management_id) || !nonempty(row.seller_name)
    || !nonempty(row.recycler_id) || !nonempty(row.recycler_name) || !nonempty(row.login_account, 80)
    || !integer(row.quote_amount) || !integer(row.buyer_pay_amount) || !integer(row.seller_receivable_amount)
    || !object(row.fee_snapshot)) fail()
  const fee = object(row.fee_snapshot)!
  if (!integer(fee.guarantee_fee_amount) || !nonempty(fee.guarantee_fee_rate, 20)) fail()
  const status = row.status as string
  if (!['active', 'rejected', 'expired', 'invalidated', 'pending_payment', 'payment_expired', 'completed'].includes(status)) fail()
  return {
    recycleOrderId: String(row.recycle_order_id),
    recycleOrderNo: String(row.recycle_order_no),
    status,
    recycleConsultationId: String(row.recycle_consultation_id),
    sellerManagementId: String(row.seller_management_id),
    sellerName: String(row.seller_name),
    recyclerId: String(row.recycler_id),
    recyclerName: String(row.recycler_name),
    loginAccount: String(row.login_account),
    quoteAmountFen: row.quote_amount as number,
    guaranteeFeeAmountFen: fee.guarantee_fee_amount as number,
    guaranteeFeeRate: String(fee.guarantee_fee_rate),
    sellerReceivableAmountFen: row.seller_receivable_amount as number,
    buyerPayAmountFen: row.buyer_pay_amount as number,
    paymentStatus: typeof row.trade_order_payment_status === 'string' && row.trade_order_payment_status ? row.trade_order_payment_status : null,
    description: typeof row.description === 'string' ? row.description : '',
    validUntil: typeof row.valid_until === 'number' && Number.isFinite(row.valid_until) ? row.valid_until : null,
  }
}

/** 接口返回 ClientRecycleActionResultDto（{ order }），解析在包装层展开。 */
function parseOrderResult(input: unknown): RestoredRecycleOrder {
  const row = object(input)
  if (!row || !Object.hasOwn(row, "order")) fail()
  return parseOrder(row.order)
}

const id = (value: string) => encodeURIComponent(value)

// transport.read/write 已用 parseOrder 解析 envelope.data，这里直接取用，不能二次解析。
export function createRestoredRecycleOrderApi(transport: Pick<ReturnType<typeof createRestoredLinkedTransport>, 'read' | 'write'>): RestoredRecycleOrderApi {
  const orderPath = (consultationId: string, suffix = '') => `/client/recycle/consultations/${id(consultationId)}/order${suffix}`
  return {
    readOrder: (consultationId, signal) => transport.read(orderPath(consultationId), parseOrderResult, signal).then(envelope => envelope.data),
    createQuote: (consultationId, body, key, signal) =>
      transport.write(orderPath(consultationId), body, key, parseOrderResult, signal).then(envelope => envelope.data),
    confirmOrder: (consultationId, expectedStatus, key, signal) =>
      transport.write(orderPath(consultationId, '/confirm'), { expectedStatus }, key, parseOrderResult, signal).then(envelope => envelope.data),
    rejectOrder: (consultationId, expectedStatus, reason, key, signal) =>
      transport.write(orderPath(consultationId, '/reject'), { expectedStatus, reason }, key, parseOrderResult, signal).then(envelope => envelope.data),
    payOrder: (consultationId, expectedStatus, key, signal) =>
      transport.write(orderPath(consultationId, '/pay'), { expectedStatus }, key, parseOrderResult, signal).then(envelope => envelope.data),
  } satisfies RestoredRecycleOrderApi
}
