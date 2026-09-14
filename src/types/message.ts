export type MessageCategory = 'all' | 'groups' | 'notifications'
export type ConversationKind = 'trade_group' | 'support' | 'notification'
export type ConversationStage = 'need_action' | 'in_progress' | 'closed'
export type TradeState = 'binding' | 'confirmed' | 'mismatch' | 'closed'
export type MessageSender = 'buyer' | 'seller' | 'support' | 'system'
export type MessageDelivery = 'sending' | 'sent' | 'failed'

export type Conversation = {
  id: string
  kind: ConversationKind
  stage: ConversationStage
  tradeState?: TradeState
  gameCode?: string
  title: string
  avatarText: string
  orderId?: string
  productCode?: string
  orderAmount?: number
  progressLabel?: string
  elapsedLabel?: string
  lastMessage: string
  updatedAt: number
  unreadCount: number
  closed?: boolean
  /** 完整流程演示记录：群已归档，订单仍保留成交结果。 */
  historyPreview?: boolean
  workflowPhase?: import('../components/tradeFlowModel').TradePhase
  /** 会话摘要对应的订单，防止共享会话串改其他订单。 */
  workflowOrderId?: string
  pausedPhase?: import('../components/tradeFlowModel').TradePhase
  viewerRole?: 'buyer' | 'seller'
}

export type ConversationMessage = {
  id: string
  conversationId: string
  sender: MessageSender
  senderName: string
  content: string
  createdAt: number
  kind: 'text' | 'system' | 'image' | 'trade_card'
  tradeCard?: TradeHistoryCard
  delivery: MessageDelivery
  imageUrl?: string
}

export type TradeHistoryCard = {
  key: string
  title?: string
  body?: string
  variant?: 'critical' | 'completed' | 'paused' | 'product'
  audience?: '买家' | '卖家'
  statuses?: Array<{ text: string; tone: 'updated' | 'submitted' }>
  notices?: Array<{ title: string; paragraphs: string[] }>
  fields?: 'empty' | 'credentials' | 'phone' | 'delivery'
  actions?: string[]
  actionTones?: Array<'default' | 'primary' | 'disabled'>
  safe?: string
  countdown?: string
}

export type NotificationKind = 'trade' | 'aftersales' | 'listing' | 'system'
export type NotificationItem = {
  id: string
  kind: NotificationKind
  group: '需要处理' | '今天' | '更早'
  title: string
  body: string
  time: string
  tag: string
  unread?: boolean
  action?: string
  href?: string
  icon: 'shield' | 'clock' | 'check' | 'gem' | 'bell' | 'info' | 'wallet'
}

export type MessageStore = { conversations: Conversation[]; messages: ConversationMessage[]; notifications?: NotificationItem[] }
export type MessageSummary = { unreadCount: number; groupCount: number; taskCount: number }
