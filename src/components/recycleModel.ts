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
  const loginAccount = draft.loginAccount.trim()
  if (loginAccount.length < 2 || loginAccount.length > 40) errors.loginAccount = '请填写 2 至 40 个字符的登录账号'
  if (/\s/.test(loginAccount)) errors.loginAccount = '登录账号不能包含空格'
  if (!draft.realnameStatus) errors.realnameStatus = '请选择实名情况'
  if (!draft.nobleLevel || !/^V(?:[0-9]|10)$/.test(draft.nobleLevel)) errors.nobleLevel = '请选择 V0 至 V10 的贵族等级'
  if (!draft.antiAddiction) errors.antiAddiction = '请选择有无防沉迷'
  if (draft.screenshots.length > 15) errors.screenshots = '补充截图合计最多 15 张'
  if (draft.screenshots.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType) || file.size <= 0 || file.size > 5 * 1024 * 1024)) errors.screenshots = '仅支持单张不超过 5MB 的 JPG、PNG 或 WEBP 图片'
  if (draft.note.length > 200) errors.note = '补充说明最多 200 字'
  if (/(密码|验证码|身份证|银行卡|(?:^|\D)1[3-9]\d{9}(?:\D|$))/i.test(draft.note)) errors.note = '补充说明中不能包含密码、验证码或敏感个人信息'
  return errors
}

export function getRecycleDraftSummary(draft?: RecycleOrderDraft) {
  if (!draft) return null
  return `${draft.realnameStatus} · ${draft.nobleLevel} · ${draft.antiAddiction}`
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
