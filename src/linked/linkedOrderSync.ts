import type { OrderRecord, OrderRole, OrderStatus } from '../types/order'
import { orderRepository } from '../repository/orderRepository'

/**
 * HTTP 联动的订单同步：把后台 order-management 订单映射为原型 OrderRecord，
 * 以买卖双视角灌入内存订单仓库；订单页组件（列表/详情/倒计时/操作）零改动复用。
 * 仅 linked 模式调用；数据随页面会话存续，不新增持久化。
 */

export type AdminOrderRow = {
  id: string
  orderNo: string
  status: string
  amountFen: number
  paidAmountFen?: number
  buyer?: { userRef?: string; displayName?: string; mobileMasked?: string | null }
  seller?: { userRef?: string; displayName?: string; mobileMasked?: string | null }
  createdAt?: string
  updatedAt?: string
  goods?: { goodsNo?: string; title?: string; coverUrl?: string | null; game?: { code?: string; name?: string } ; regionName?: string | null; serverName?: string | null }
}

const STATUS_BY_ADMIN: Record<string, OrderStatus> = {
  PENDING_PAYMENT: 'pending',
  PAID: 'paid',
  // 后台 DELIVERING = 支付后平台交付中；演示链路里买家可直接确认收货放款，
  // 因此映射到原型的"待确认放款"（bind_success）而不是换绑中（binding）。
  WAITING_CONFIRM: 'bind_success',
  DELIVERING: 'bind_success',
  COMPLETED: 'completed',
  // 售后处理中：仍属交易履约分组，展示为处理中（binding）
  AFTER_SALE: 'binding',
  REFUNDED: 'closed',
  CANCELLED: 'cancelled',
}

const fallbackThumbnails: Record<string, string> = {
  dwrg: '/assets/games/dwrg.png',
  wzry: '/assets/games/wzry.png',
  sjzxd: '/assets/games/delta.png',
}

/** 后台封面是 admin-api 静态资源路径，在原型域名不可达时回退游戏图标。 */
function orderThumbnail(row: AdminOrderRow): string {
  const gameCode = row.goods?.game?.code ?? 'wzry'
  const cover = row.goods?.coverUrl
  return cover && !cover.startsWith('/assets/goods/') ? cover : fallbackThumbnails[gameCode] ?? fallbackThumbnails.wzry
}

function toOrderRecord(row: AdminOrderRow, role: OrderRole): OrderRecord {
  const amount = Number.isFinite(row.amountFen) ? Math.max(0, Math.round(row.amountFen)) : 0
  const createdAt = row.createdAt ? Date.parse(row.createdAt) || Date.now() : Date.now()
  const updatedAt = row.updatedAt ? Date.parse(row.updatedAt) || createdAt : createdAt
  return {
    id: role === 'buyer' ? row.id : `${row.id}|seller`,
    role,
    status: STATUS_BY_ADMIN[row.status] ?? 'closed',
    productId: row.goods?.goodsNo ?? row.id,
    productTitle: row.goods?.title ?? row.orderNo,
    gameName: row.goods?.game?.name ?? '未知游戏',
    gameCode: (row.goods?.game?.code ?? 'wzry') as OrderRecord['gameCode'],
    server: row.goods?.regionName || row.goods?.serverName || '—',
    thumbnail: orderThumbnail(row),
    goodsAmountCents: amount,
    serviceAmountCents: 0,
    insuranceAmountCents: 0,
    totalAmountCents: amount,
    createdAt,
    updatedAt,
  }
}

/** 后台订单 → 买卖双视角（买入/卖出两个 Tab 都有真实后台数据）。 */
export function seedLinkedOrders(rows: readonly AdminOrderRow[]): OrderRecord[] {
  const records = rows.flatMap((row) => [toOrderRecord(row, 'buyer' as OrderRole), toOrderRecord(row, 'seller' as OrderRole)])
  orderRepository.replaceAll(records)
  return records
}

/** 联动订单操作编排：取最新行（rowVersion + 买卖双方引用）→ 执行 → 成功后回灌订单仓库。 */
export async function runLinkedOrderAction(
  orderId: string,
  run: (row: import('./httpLinkedClient').LinkedClientOrderRow) => Promise<import('./httpLinkedClient').LinkedClientActionResult>,
): Promise<import('./httpLinkedClient').LinkedClientActionResult> {
  const { fetchLinkedOrderRows } = await import('./httpLinkedClient')
  const rawId = orderId.replace(/\|seller$/, '')
  const rows = await fetchLinkedOrderRows()
  const row = rows.find((item) => item.id === rawId)
  if (!row) return { ok: false, detail: '订单已在后台更新，请刷新后重试' }
  const result = await run(row)
  if (result.ok) seedLinkedOrders(await fetchLinkedOrderRows())
  return result
}
