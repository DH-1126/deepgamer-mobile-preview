import { assetPath } from '../components/assetPath'
import type { Conversation, ConversationMessage } from '../types/message'
import type { OrderRecord, OrderStatus, OrderWorkflowPhase } from '../types/order'

const productTitle = '【WZUYX001】【17165】贵族等级11/荣耀典藏数量20/传说皮肤数量139/史诗皮肤数量318/皮肤数量820/英雄数量121/段位最强王者'
const productTags = ['V11', '铠银白咏叹调', '寅虎心曲']
const productThumbnail = assetPath('assets/catalog-v2/product-featured-2.png')

type ListOrderSample = {
  id: string
  role: OrderRecord['role']
  status: OrderStatus
  phase: OrderWorkflowPhase
  title?: string
  goodsAmountCents?: number
  totalAmountCents?: number
  insuranceAmountCents?: number
  expiresAt?: (now: number) => number
  actionExpiresAt?: (now: number) => number
  afterSaleEndsAt?: (now: number) => number
  refundAmountCents?: number
  cancelReason?: string
}

const samples: ListOrderSample[] = [
  { id: 'OD3015035674505896501', role: 'buyer', status: 'pending', phase: 'materials', expiresAt: now => now + 30 * 60_000 },
  { id: 'OD3015035674505896502', role: 'buyer', status: 'paid', phase: 'materials' },
  { id: 'OD3015035674505896503', role: 'buyer', status: 'verifying', phase: 'inspection' },
  { id: 'OD3015035674505896504', role: 'buyer', status: 'binding', phase: 'binding' },
  { id: 'OD3015035674505896505', role: 'buyer', status: 'bind_success', phase: 'release', actionExpiresAt: now => now + 72 * 60 * 60_000 },
  { id: 'OD3015035674505896506', role: 'buyer', status: 'completed', phase: 'completed', afterSaleEndsAt: now => now + 7 * 24 * 60 * 60_000 },
  { id: 'OD3015035674505896507', role: 'buyer', status: 'closed', phase: 'closed', refundAmountCents: 1_644_280 },
  { id: 'OD3015035674505896508', role: 'buyer', status: 'pay_expired', phase: 'closed' },
  { id: 'OD3015035674505896509', role: 'buyer', status: 'cancelled', phase: 'closed', cancelReason: '找到更合适的号' },
  { id: 'OD3015035674505896510', role: 'seller', status: 'completed', phase: 'completed', title: `回收商品 ·${productTitle}`, goodsAmountCents: 1_288_000, totalAmountCents: 1_288_000 },
  { id: 'OD3015035674505896511', role: 'buyer', status: 'signed', phase: 'signed', insuranceAmountCents: 164_428 },
  { id: 'OD3015035674505896512', role: 'buyer', status: 'insuring', phase: 'insuring', insuranceAmountCents: 164_428 },
  { id: 'OD3015035674505896513', role: 'buyer', status: 'insured', phase: 'insured', insuranceAmountCents: 164_428 },
]

function conversationState(sample: ListOrderSample): Pick<Conversation, 'stage' | 'tradeState'> {
  if (sample.phase === 'closed') return { stage: 'closed', tradeState: 'closed' }
  if (sample.phase === 'completed') return { stage: 'closed', tradeState: 'closed' }
  if (sample.status === 'bind_success') return { stage: 'need_action', tradeState: 'confirmed' }
  return { stage: sample.status === 'pending' ? 'need_action' : 'in_progress', tradeState: 'binding' }
}

function progressLabel(sample: ListOrderSample): string {
  const labels: Record<OrderWorkflowPhase, string> = {
    materials: '步骤 1 / 4 · 等待资料确认',
    inspection: '步骤 2 / 4 · 核对账号资料',
    binding: '步骤 3 / 4 · 账号换绑中',
    signed: '步骤 4 / 7 · 签署完成',
    insuring: '步骤 5 / 7 · 投保中',
    insured: '步骤 6 / 7 · 投保成功',
    release: '步骤 4 / 4 · 待确认收货',
    completed: '交易完成',
    closed: sample.status === 'cancelled' ? '订单已取消' : sample.status === 'pay_expired' ? '付款已超时' : '交易已关闭',
  }
  return labels[sample.phase]
}

/** 订单列表展示的十种独立场景，和消息列表共用相同订单/会话关联。 */
export function createOrderListSeed(now: number): { orders: OrderRecord[]; conversations: Conversation[]; messages: ConversationMessage[] } {
  const orders = samples.map((sample, index) => {
    const updatedAt = now - index * 1_000
    const title = sample.title ?? productTitle
    const goodsAmountCents = sample.goodsAmountCents ?? 1_644_280
    const totalAmountCents = sample.totalAmountCents ?? 1_644_280
    const conversationId = `trade-list-${sample.id}`
    return {
      id: sample.id,
      role: sample.role,
      status: sample.status,
      orderKind: sample.role === 'seller' ? 'recycle' : 'account',
      productId: sample.role === 'seller' ? 'recycle-wzuyx001' : 'wzuyx001-17165',
      productTitle: title,
      gameName: '王者荣耀',
      gameCode: 'wzry',
      server: '安卓QQ',
      thumbnail: productThumbnail,
      listTags: productTags,
      goodsAmountCents,
      serviceAmountCents: 0,
      insuranceAmountCents: sample.insuranceAmountCents ?? 0,
      totalAmountCents,
      createdAt: updatedAt - (index + 1) * 60_000,
      updatedAt,
      expiresAt: sample.expiresAt?.(now),
      actionExpiresAt: sample.actionExpiresAt?.(now),
      afterSaleEndsAt: sample.afterSaleEndsAt?.(now),
      refundAmountCents: sample.refundAmountCents,
      cancelReason: sample.cancelReason,
      conversationId,
    } satisfies OrderRecord
  })
  const conversations = samples.map((sample, index) => {
    const order = orders[index]
    const state = conversationState(sample)
    return {
      id: order.conversationId!,
      kind: 'trade_group',
      ...state,
      workflowPhase: sample.phase,
      workflowOrderId: order.id,
      viewerRole: sample.role,
      gameCode: order.gameCode,
      title: sample.role === 'seller' ? '王者荣耀 回收交易群' : '王者荣耀 安卓QQ',
      avatarText: '王',
      orderId: order.id,
      productCode: 'WZUYX001',
      orderAmount: order.totalAmountCents / 100,
      progressLabel: progressLabel(sample),
      elapsedLabel: '刚刚',
      lastMessage: `平台：${progressLabel(sample)}`,
      updatedAt: order.updatedAt,
      unreadCount: 0,
      closed: sample.phase === 'completed' || sample.phase === 'closed',
    } satisfies Conversation
  })
  const messages = samples.map((sample, index) => ({
    id: `order-list-system-${sample.id}`,
    conversationId: orders[index].conversationId!,
    sender: 'system',
    senderName: '平台',
    content: `订单状态更新：${progressLabel(sample)}`,
    createdAt: orders[index].updatedAt,
    kind: 'system',
    delivery: 'sent',
  } satisfies ConversationMessage))

  return { orders, conversations, messages }
}
