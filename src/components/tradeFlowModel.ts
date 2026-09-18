import type { Conversation } from '../types/message'
import type { OrderRecord } from '../types/order'

export type TradeRole = 'buyer' | 'seller'
export type TradePhase = 'materials' | 'inspection' | 'binding' | 'signed' | 'insuring' | 'insured' | 'release' | 'completed' | 'paused' | 'closed'
export type TradeAction = 'submit_materials' | 'finish_inspection' | 'finish_binding' | 'release_funds' | 'report_issue'

export const tradePhases: TradePhase[] = ['materials', 'inspection', 'binding', 'signed', 'insuring', 'insured', 'release', 'completed', 'paused', 'closed']
export function isTradePhase(value: unknown): value is TradePhase { return tradePhases.includes(value as TradePhase) }

export function getConversationPhase(conversation: Conversation): TradePhase {
  if (conversation.workflowPhase) return conversation.workflowPhase
  if (conversation.tradeState === 'mismatch') return 'paused'
  if (conversation.tradeState === 'closed') return conversation.progressLabel?.includes('完成') ? 'completed' : 'closed'
  if (conversation.tradeState === 'confirmed') return 'release'
  if (conversation.tradeState === 'binding') return 'binding'
  return 'materials'
}

export function isOrderConversationMatch(order: OrderRecord | undefined, conversation: Conversation, requestedOrderId: string | null) {
  return Boolean(order && requestedOrderId === order.id && order.conversationId === conversation.id && conversation.orderId === order.id)
}

export function isTradePreviewMode(scenario: string | null, phase: string | null) {
  return scenario === 'preview' || isTradePhase(phase)
}

export function getTradeStep(phase: TradePhase, previous: TradePhase = 'inspection'): number {
  if (phase === 'paused') return previous === 'paused' ? 2 : getTradeStep(previous)
  return ({ materials: 1, inspection: 2, binding: 3, signed: 4, insuring: 5, insured: 6, release: 7, completed: 7, closed: 7 })[phase]
}

export function getTradeProgress(phase: TradePhase, insuredFlow: boolean, previous: TradePhase = 'inspection') {
  const phases: TradePhase[] = insuredFlow
    ? ['materials', 'inspection', 'binding', 'signed', 'insuring', 'insured', 'release']
    : ['materials', 'inspection', 'binding', 'signed', 'release']
  const resolved = phase === 'paused' ? previous : phase
  const index = phases.indexOf(resolved)
  return { current: phase === 'completed' || phase === 'closed' ? phases.length : Math.max(1, index + 1), total: phases.length }
}

export function getTradePhaseTitle(phase: TradePhase, role: TradeRole) {
  const seller = role === 'seller'
  return ({ materials: seller ? '你来同步资料' : '等卖家同步资料', inspection: seller ? '等买家验号' : '你来验号', binding: seller ? '你来换绑' : '等卖家换绑', signed: '协议签署完成', insuring: '平台投保中', insured: '投保成功', release: seller ? '等买家确认放款' : '你来确认放款', completed: '交易完成', paused: '验号异常', closed: '交易已关闭' })[phase]
}

export function nextTradePhase(phase: TradePhase, role: TradeRole, action: TradeAction): TradePhase | null {
  if (['completed', 'closed', 'paused'].includes(phase)) return null
  if (action === 'report_issue') return 'paused'
  if (phase === 'materials' && role === 'seller' && action === 'submit_materials') return 'inspection'
  if (phase === 'inspection' && role === 'buyer' && action === 'finish_inspection') return 'binding'
  if (phase === 'binding' && role === 'seller' && action === 'finish_binding') return 'signed'
  if (phase === 'release' && role === 'buyer' && action === 'release_funds') return 'completed'
  return null
}

export function validateTradeIssue(type: string, description: string, files: File[] = []) {
  if (!type) return '请选择问题类型'
  if (!description.trim()) return '请描述遇到的问题'
  if (description.trim().length > 500) return '问题描述不能超过 500 字'
  if (files.length > 6) return '最多上传 6 张图片'
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) return '请使用不超过 10MB 的 JPG、PNG 或 WebP 图片'
  return ''
}
