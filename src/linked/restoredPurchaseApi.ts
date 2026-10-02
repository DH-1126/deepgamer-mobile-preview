import { collectRestoredPages, type createRestoredLinkedTransport } from './restoredLinkedTransport'

type Transport = Pick<ReturnType<typeof createRestoredLinkedTransport>, 'read' | 'write'>
type RecordValue = Record<string, unknown>

export type RestoredPurchasePackage = 'STANDARD' | 'PREMIUM'
export type RestoredPaymentResult = 'SUCCESS' | 'FAILED' | 'UNKNOWN'
export type RestoredSafeOperationStatus = 'UNKNOWN' | 'FAILED' | 'SUCCEEDED' | 'REFUND_REQUIRED'

export interface RestoredPublicGoods {
  id: string
  goodsNo: string
  title: string
  priceFen: number
  currency: 'CNY'
  description: string
  coverUrl: string | null
  images: string[]
  game: { id: string; code: string; name: string }
  seller: { sellerRef: string; displayName: string }
  attributes: Array<{ refType: 'ATTRIBUTE' | 'GROUP'; refKey: string; valueType: string; value: unknown; configVersionId: string }>
  contentRevision: number
  rowVersion: number
  snapshotId: string
  schemaHash: string
  productStatus: 'ON_SALE'
  auditStatus: 'APPROVED'
  locked: boolean
  createdAt: string
  updatedAt: string
}

export interface RestoredPurchaseQuote {
  quoteId: string
  quoteVersion: number
  expiresAt: string
  goodsId: string
  goodsVersion: number
  currency: 'CNY'
  packageSnapshot: { packageId: RestoredPurchasePackage; label: string; pricingVersion: string | null }
  amounts: { goodsAmountFen: number; serviceFeeFen: number; guaranteeFeeFen: number; discountFen: number; payableAmountFen: number }
  purchasable: boolean
  blockedReason: 'PRICING_NOT_CONFIGURED' | 'GOODS_UNAVAILABLE' | 'GOODS_NOT_APPROVED' | null
}

export interface RestoredSafeOperation {
  operationId: string
  orderId: string
  amountFen: number
  currency: 'CNY'
  status: RestoredSafeOperationStatus
  createdAt: string
  updatedAt: string
}

export interface RestoredPaymentContext {
  orderId: string
  rowVersion: number
  canStartPayment: boolean
  blockedReason: string | null
  operation: RestoredSafeOperation | null
}

export interface RestoredQuoteRecovery {
  quote: RestoredPurchaseQuote
  orderId: string | null
}

export interface RestoredPurchaseAction {
  order: { id: string; status: string; rowVersion: number }
  operation: RestoredSafeOperation | null
}

export interface RestoredPaymentSubmission {
  rowVersion: number
  operationId: string
  simulatedResult: RestoredPaymentResult
  simulatedReceiptRef?: string
}

function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function exact(row: RecordValue, keys: readonly string[], fail: () => never) {
  if (Object.keys(row).some(key => !keys.includes(key))) fail()
}

function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0 }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === 'string' }
function offsetDatetime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    && Number.isFinite(Date.parse(value))
}
function positiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 }
function amount(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }

function invalidGoods(): never { throw new Error('公开商品数据不符合契约') }

export function parseRestoredPublicGoods(value: unknown): RestoredPublicGoods {
  const row = object(value), game = object(row?.game), seller = object(row?.seller)
  if (!row || !game || !seller || !Array.isArray(row.images) || !Array.isArray(row.attributes)) invalidGoods()
  exact(row, ['id', 'goodsNo', 'title', 'priceFen', 'currency', 'description', 'coverUrl', 'images', 'game', 'seller', 'attributes', 'contentRevision', 'rowVersion', 'snapshotId', 'schemaHash', 'productStatus', 'auditStatus', 'locked', 'createdAt', 'updatedAt'], invalidGoods)
  exact(game, ['id', 'code', 'name'], invalidGoods); exact(seller, ['sellerRef', 'displayName'], invalidGoods)
  if (!text(row.id) || typeof row.goodsNo !== 'string' || typeof row.title !== 'string' || !amount(row.priceFen) || row.currency !== 'CNY'
    || typeof row.description !== 'string' || !nullableText(row.coverUrl) || row.images.some(item => !text(item))
    || !text(game.id) || !text(game.code) || typeof game.name !== 'string' || !text(seller.sellerRef) || typeof seller.displayName !== 'string'
    || !positiveInteger(row.contentRevision) || !positiveInteger(row.rowVersion) || !text(row.snapshotId) || typeof row.schemaHash !== 'string' || row.schemaHash.length !== 64
    || row.productStatus !== 'ON_SALE' || row.auditStatus !== 'APPROVED' || typeof row.locked !== 'boolean' || !text(row.createdAt) || !text(row.updatedAt)) invalidGoods()
  const attributes = row.attributes.map(value => {
    const attribute = object(value)
    if (!attribute) invalidGoods()
    exact(attribute, ['refType', 'refKey', 'valueType', 'value', 'configVersionId'], invalidGoods)
    if (!['ATTRIBUTE', 'GROUP'].includes(String(attribute.refType)) || !text(attribute.refKey) || !text(attribute.valueType) || !text(attribute.configVersionId)) invalidGoods()
    return { refType: attribute.refType as 'ATTRIBUTE' | 'GROUP', refKey: attribute.refKey, valueType: attribute.valueType, value: attribute.value, configVersionId: attribute.configVersionId }
  })
  return {
    id: row.id, goodsNo: row.goodsNo, title: row.title, priceFen: row.priceFen, currency: 'CNY', description: row.description,
    coverUrl: row.coverUrl, images: row.images, game: { id: game.id, code: game.code, name: game.name },
    seller: { sellerRef: seller.sellerRef, displayName: seller.displayName }, attributes,
    contentRevision: row.contentRevision, rowVersion: row.rowVersion, snapshotId: row.snapshotId, schemaHash: row.schemaHash,
    productStatus: 'ON_SALE', auditStatus: 'APPROVED', locked: row.locked, createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}

function invalidQuote(): never { throw new Error('报价数据不符合契约') }

export function parseRestoredQuote(value: unknown): RestoredPurchaseQuote {
  const row = object(value), packageSnapshot = object(row?.packageSnapshot), amounts = object(row?.amounts)
  if (!row || !packageSnapshot || !amounts) invalidQuote()
  exact(row, ['quoteId', 'quoteVersion', 'expiresAt', 'goodsId', 'goodsVersion', 'currency', 'packageSnapshot', 'amounts', 'purchasable', 'blockedReason'], invalidQuote)
  exact(packageSnapshot, ['packageId', 'label', 'pricingVersion'], invalidQuote)
  exact(amounts, ['goodsAmountFen', 'serviceFeeFen', 'guaranteeFeeFen', 'discountFen', 'payableAmountFen'], invalidQuote)
  const blockedReasons = ['PRICING_NOT_CONFIGURED', 'GOODS_UNAVAILABLE', 'GOODS_NOT_APPROVED']
  if (!text(row.quoteId) || !positiveInteger(row.quoteVersion) || !offsetDatetime(row.expiresAt) || !text(row.goodsId)
    || !positiveInteger(row.goodsVersion) || row.currency !== 'CNY' || !['STANDARD', 'PREMIUM'].includes(String(packageSnapshot.packageId))
    || !text(packageSnapshot.label) || !nullableText(packageSnapshot.pricingVersion)
    || !amount(amounts.goodsAmountFen) || !amount(amounts.serviceFeeFen) || !amount(amounts.guaranteeFeeFen) || !amount(amounts.discountFen) || !amount(amounts.payableAmountFen)
    || typeof row.purchasable !== 'boolean' || !(row.blockedReason === null || blockedReasons.includes(String(row.blockedReason)))) invalidQuote()
  const expected = amounts.goodsAmountFen + amounts.serviceFeeFen + amounts.guaranteeFeeFen - amounts.discountFen
  if (!Number.isSafeInteger(expected) || expected < 0 || expected !== amounts.payableAmountFen || row.purchasable === (row.blockedReason !== null)) invalidQuote()
  return {
    quoteId: row.quoteId, quoteVersion: row.quoteVersion, expiresAt: row.expiresAt, goodsId: row.goodsId, goodsVersion: row.goodsVersion, currency: 'CNY',
    packageSnapshot: { packageId: packageSnapshot.packageId as RestoredPurchasePackage, label: packageSnapshot.label, pricingVersion: packageSnapshot.pricingVersion },
    amounts: { goodsAmountFen: amounts.goodsAmountFen, serviceFeeFen: amounts.serviceFeeFen, guaranteeFeeFen: amounts.guaranteeFeeFen, discountFen: amounts.discountFen, payableAmountFen: amounts.payableAmountFen },
    purchasable: row.purchasable, blockedReason: row.blockedReason as RestoredPurchaseQuote['blockedReason'],
  }
}

function invalidSafeOperation(): never { throw new Error('安全支付操作不符合契约') }

function parseSafeOperation(value: unknown, strict = true): RestoredSafeOperation {
  const row = object(value)
  if (!row) invalidSafeOperation()
  if (strict) exact(row, ['operationId', 'orderId', 'amountFen', 'currency', 'status', 'createdAt', 'updatedAt'], invalidSafeOperation)
  if (!text(row.operationId) || !text(row.orderId) || !amount(row.amountFen) || row.currency !== 'CNY'
    || !['UNKNOWN', 'FAILED', 'SUCCEEDED', 'REFUND_REQUIRED'].includes(String(row.status)) || !offsetDatetime(row.createdAt) || !offsetDatetime(row.updatedAt)) invalidSafeOperation()
  return { operationId: row.operationId, orderId: row.orderId, amountFen: row.amountFen, currency: 'CNY', status: row.status as RestoredSafeOperationStatus, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

function invalidPaymentContext(): never { throw new Error('支付上下文不符合契约') }

export function parseRestoredPaymentContext(value: unknown): RestoredPaymentContext {
  const row = object(value)
  if (!row) invalidPaymentContext()
  exact(row, ['orderId', 'rowVersion', 'canStartPayment', 'blockedReason', 'operation'], invalidPaymentContext)
  if (!text(row.orderId) || !positiveInteger(row.rowVersion) || typeof row.canStartPayment !== 'boolean' || !(row.blockedReason === null || text(row.blockedReason)) || !(row.operation === null || object(row.operation))) invalidPaymentContext()
  let operation: RestoredSafeOperation | null = null
  try { operation = row.operation === null ? null : parseSafeOperation(row.operation, true) } catch { invalidPaymentContext() }
  if (operation && operation.orderId !== row.orderId) invalidPaymentContext()
  return { orderId: row.orderId, rowVersion: row.rowVersion, canStartPayment: row.canStartPayment, blockedReason: row.blockedReason, operation }
}

function parseQuoteRecovery(value: unknown): RestoredQuoteRecovery {
  const row = object(value)
  if (!row) invalidQuote()
  exact(row, ['quote', 'orderId'], invalidQuote)
  if (!(row.orderId === null || text(row.orderId))) invalidQuote()
  const recovered = { quote: parseRestoredQuote(row.quote), orderId: row.orderId }
  return recovered
}

function parseAction(value: unknown): RestoredPurchaseAction {
  const row = object(value), order = object(row?.order)
  if (!row || !order || !text(order.id) || !text(order.status) || !positiveInteger(order.rowVersion)) throw new Error('订单操作结果不符合契约')
  let operation: RestoredSafeOperation | null = null
  if (row.operation !== undefined && row.operation !== null) operation = parseSafeOperation(row.operation, false)
  return { order: { id: order.id, status: order.status, rowVersion: order.rowVersion }, operation }
}

function parseGoodsArray(value: unknown): RestoredPublicGoods[] {
  if (!Array.isArray(value)) invalidGoods()
  return value.map(parseRestoredPublicGoods)
}

function segment(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/u.test(value)) throw new Error(`${label}格式错误`)
  return encodeURIComponent(value)
}

export function createRestoredPurchaseApi(transport: Transport) {
  return {
    async listPublicGoods(signal?: AbortSignal): Promise<RestoredPublicGoods[]> {
      return collectRestoredPages(
        (page, pageSignal) => transport.read(`/client/catalog/goods?page=${page}&pageSize=50`, parseGoodsArray, pageSignal),
        item => item.id,
        signal,
      )
    },
    async readPublicGoods(goodsId: string, signal?: AbortSignal): Promise<RestoredPublicGoods> {
      const goods = (await transport.read(`/client/catalog/goods/${segment(goodsId, '商品标识')}`, parseRestoredPublicGoods, signal)).data
      if (goods.id !== goodsId) invalidGoods()
      return goods
    },
    async createQuote(goodsId: string, packageId: RestoredPurchasePackage, key: string, signal?: AbortSignal): Promise<RestoredPurchaseQuote> {
      return (await transport.write('/client/quotes', { goodsId, packageId }, key, parseRestoredQuote, signal)).data
    },
    async recoverQuote(quoteId: string, signal?: AbortSignal): Promise<RestoredQuoteRecovery> {
      const recovered = (await transport.read(`/client/quotes/${segment(quoteId, '报价标识')}`, parseQuoteRecovery, signal)).data
      if (recovered.quote.quoteId !== quoteId) invalidQuote()
      return recovered
    },
    async createOrder(quoteId: string, key: string, signal?: AbortSignal): Promise<RestoredPurchaseAction> {
      return (await transport.write('/client/orders', { quoteId }, key, parseAction, signal)).data
    },
    async readPaymentContext(orderId: string, signal?: AbortSignal): Promise<RestoredPaymentContext> {
      const context = (await transport.read(`/client/orders/${segment(orderId, '订单标识')}/payment-context`, parseRestoredPaymentContext, signal)).data
      if (context.orderId !== orderId) invalidPaymentContext()
      return context
    },
    async submitPayment(orderId: string, input: RestoredPaymentSubmission, key: string, signal?: AbortSignal): Promise<RestoredPurchaseAction> {
      const body = { rowVersion: input.rowVersion, channel: 'WECHAT' as const, operationId: input.operationId, simulatedResult: input.simulatedResult, ...(input.simulatedReceiptRef ? { simulatedReceiptRef: input.simulatedReceiptRef } : {}) }
      const action = (await transport.write(`/client/orders/${segment(orderId, '订单标识')}/pay`, body, key, parseAction, signal)).data
      if (action.order.id !== orderId || action.operation && (action.operation.orderId !== orderId || action.operation.operationId !== input.operationId)) throw new Error('支付结果与原订单或原操作不匹配')
      return action
    },
  }
}
