import type { Conversation } from '../types/message'
import type { OrderRecord, OrderStatus } from '../types/order'
import { getConversationPhase, isOrderConversationMatch } from './tradeFlowModel'

export type TradeConversationStatus = 'pending' | 'materials' | 'inspection' | 'binding' | 'signed' | 'insuring' | 'insured' | 'release' | 'completed' | 'closed'

export const tradeConversationStatuses = {
  pending: { label: '待付款', tone: 'warning' },
  materials: { label: '资料同步', tone: 'info' },
  inspection: { label: '验号', tone: 'info' },
  binding: { label: '换绑', tone: 'info' },
  signed: { label: '签署完成', tone: 'info' },
  insuring: { label: '投保中', tone: 'info' },
  insured: { label: '投保成功', tone: 'success' },
  release: { label: '确认放款', tone: 'info' },
  completed: { label: '完成', tone: 'success' },
  closed: { label: '关闭', tone: 'neutral' },
} as const

const orderStatuses: Record<OrderStatus, TradeConversationStatus> = {
  pending: 'pending', paid: 'materials', verifying: 'inspection', binding: 'binding', signed: 'signed', insuring: 'insuring', insured: 'insured', bind_success: 'release',
  completed: 'completed', pay_expired: 'closed', cancelled: 'closed', closed: 'closed',
}

/** List badges describe the transaction stage, not reminders or exception text. */
export function getTradeConversationStatus(conversation: Conversation, order?: OrderRecord) {
  let status: TradeConversationStatus
  if (conversation.historyPreview && conversation.closed) status = 'closed'
  else if (order && isOrderConversationMatch(order, conversation, conversation.orderId ?? null)
    && (!conversation.workflowOrderId || conversation.workflowOrderId === order.id)) {
    status = orderStatuses[order.status]
  } else {
    const phase = getConversationPhase(conversation)
    if (phase === 'completed') status = 'completed'
    else if (phase === 'closed' || conversation.closed) status = 'closed'
    else if (phase === 'paused') {
      const previous = conversation.pausedPhase
      status = previous && ['materials', 'inspection', 'binding', 'signed', 'insuring', 'insured', 'release'].includes(previous)
        ? previous as 'materials' | 'inspection' | 'binding' | 'signed' | 'insuring' | 'insured' | 'release'
        : 'inspection'
    } else status = phase
  }
  return { status, ...tradeConversationStatuses[status] }
}
