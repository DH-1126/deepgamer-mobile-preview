import type { RecycleOrder, RecycleOrderDraft } from '../types/recycle'
import type { OrderRecord } from '../types/order'

export type RecycleViewerRole = 'seller' | 'recycler'
export type RecycleConsultationTab = 'all' | 'confirmation' | 'payment' | 'completed'

export function isRecycleViewerRole(value: string | null): value is RecycleViewerRole {
  return value === 'seller' || value === 'recycler'
}

export function getRecycleStatusLabel(order: RecycleOrder, role: RecycleViewerRole) {
  if (order.stage === 'consulting') return role === 'recycler' ? '可发送回收单' : '沟通中'
  if (order.stage === 'formal') return role === 'seller' ? '待你确认' : '等待卖家确认'
  if (order.stage === 'submitted') return role === 'recycler' ? '待你付款' : '等待回收商付款'
  if (order.stage === 'completed') return '已成交'
  if (order.stage === 'rejected') return '已结束'
  return '历史流程'
}

export function getRecyclePayableCents(order: Pick<RecycleOrder, 'quoteCents' | 'protectionFeeCents'>) {
  return order.quoteCents + (order.protectionFeeCents ?? Math.round(order.quoteCents * 0.1))
}

export function validateRecycleOrderDraft(draft: RecycleOrderDraft) {
  const errors: Partial<Record<keyof RecycleOrderDraft, string>> = {}
  if (!Number.isSafeInteger(draft.quoteCents) || draft.quoteCents < 100 || draft.quoteCents > 10_000_000) errors.quoteCents = '请输入 1 至 100000 元的回收价'
  if (draft.server.trim().length < 2 || draft.server.trim().length > 24) errors.server = '请填写 2 至 24 字的区服'
  if (draft.rank.trim().length < 2 || draft.rank.trim().length > 40) errors.rank = '请填写 2 至 40 字的段位或账号概况'
  if (draft.accountSummary.trim().length < 2 || draft.accountSummary.trim().length > 80) errors.accountSummary = '请填写 2 至 80 字的报价依据'
  if (/(密码|验证码|身份证|手机号|银行卡|(?:^|\D)1[3-9]\d{9}(?:\D|$))/i.test(draft.accountSummary)) errors.accountSummary = '报价依据中不能包含密码、验证码或个人信息'
  return errors
}

export function matchesRecycleConsultationTab(order: RecycleOrder, tab: RecycleConsultationTab) {
  if (tab === 'all') return true
  if (tab === 'confirmation') return order.stage === 'formal'
  if (tab === 'payment') return order.stage === 'submitted'
  return order.stage === 'completed'
}

export function filterRecycleConsultations(orders: readonly RecycleOrder[], tab: RecycleConsultationTab, query = '') {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  return orders.filter((order) => matchesRecycleConsultationTab(order, tab) && (!normalized || [order.id, order.gameName, order.recyclerName, order.server].some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized)))).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function createRecycleConversation(order: RecycleOrder, now: number) {
  if (!order.conversationId || !order.orderId || order.stage !== 'completed') return null
  return {
    id: order.conversationId,
    kind: 'trade_group' as const,
    stage: 'need_action' as const,
    workflowPhase: 'materials' as const,
    viewerRole: 'seller' as const,
    gameCode: order.gameCode,
    title: `${order.gameName}回收交易群`,
    avatarText: order.gameName.slice(0, 1),
    orderAmount: order.quoteCents / 100,
    updatedAt: now,
    unreadCount: 0,
    orderId: order.orderId,
    lastMessage: '平台：回收商已付款，请卖家同步账号资料',
    progressLabel: '步骤 1 / 4 · 卖家同步资料',
  }
}

export function createRecyclePaidOrderRecord(order: RecycleOrder, now: number, thumbnail = ''): OrderRecord {
  const serviceAmountCents = order.protectionFeeCents ?? Math.round(order.quoteCents * 0.1)
  return {
    id: order.orderId ?? `OD-${order.id}`,
    role: 'seller',
    status: 'paid',
    productId: `recycle-${order.id}`,
    productTitle: `${order.gameName}账号回收`,
    gameName: order.gameName,
    gameCode: order.gameCode,
    server: order.server,
    thumbnail,
    goodsAmountCents: order.quoteCents,
    serviceAmountCents,
    insuranceAmountCents: 0,
    totalAmountCents: order.quoteCents + serviceAmountCents,
    createdAt: order.createdAt,
    updatedAt: now,
    paymentMethod: 'alipay',
    conversationId: order.conversationId ?? `trade-recycle-${order.id}`,
  }
}
