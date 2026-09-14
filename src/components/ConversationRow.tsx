import { Bell, Headset } from 'lucide-react'
import type { Conversation } from '../types/message'
import type { OrderRecord } from '../types/order'
import { assetPath } from './assetPath'
import { formatConversationTime } from './messageModel'
import { getTradeConversationStatus } from './tradeConversationStatus'
import { StatusBadge } from './ui'
import './message-conversation-row.css'

export type ConversationRowProps = {
  item: Conversation
  order?: OrderRecord
  onOpen: (item: Conversation) => void
  showTypeBadge?: boolean
}

/** A reusable row for a trade, support, or system-message conversation. */
export function ConversationRow({ item, order, onOpen, showTypeBadge = false }: ConversationRowProps) {
  const timeLabel = formatConversationTime(item.updatedAt)
  const gameIcon = item.gameCode === 'sjzxd' ? 'delta' : item.gameCode === 'ys' ? 'genshin' : item.gameCode
  const tradeStatus = item.kind === 'trade_group' ? getTradeConversationStatus(item, order) : undefined
  const typeBadgeKind = ['hpjy', 'ys'].includes(item.gameCode ?? '') ? 'recycle' : 'trade'
  const badge = item.historyPreview && item.closed ? '已关闭' : tradeStatus?.label ?? (item.kind === 'support' ? '平台客服' : '系统通知')

  return <button type="button" className={`message-conversation message-d3-row kind-${item.kind}${tradeStatus ? ` trade-state-${tradeStatus.status}` : ''}`} onClick={() => onOpen(item)} aria-label={`${item.title}，${badge}，${item.lastMessage}，${timeLabel}${item.unreadCount ? `，${item.unreadCount}条未读` : ''}`}>
    <span className={`message-avatar game-${item.gameCode ?? item.kind}`}>
      {item.gameCode ? <img src={assetPath(`assets/games/${gameIcon}.png`)} alt="" /> : item.kind === 'support' ? <img src={assetPath('assets/messages-draft3/support-avatar.png')} alt="" /> : <Bell size={21} aria-hidden="true" />}
      {showTypeBadge && item.kind === 'trade_group' && <em data-kind={typeBadgeKind}>{typeBadgeKind === 'recycle' ? '回收' : '交易'}</em>}
    </span>
    <span className="message-row-copy"><span>
      <b>{item.kind === 'trade_group' ? <>{item.productCode ?? item.title} · <span className="message-order-price">¥{item.orderAmount?.toLocaleString('zh-CN')}</span></> : item.title}</b>
      {tradeStatus ? <StatusBadge className="message-trade-badge" tone={tradeStatus.tone}>{badge}</StatusBadge> : item.kind === 'support' ? <StatusBadge className="message-support-badge" tone="brand" icon={<Headset size={12} />}>{badge}</StatusBadge> : <em className="message-d3-badge">{badge}</em>}
    </span><small>{item.lastMessage}</small></span>
    <span className="message-d3-meta">{item.unreadCount > 0 && <i>{item.unreadCount}</i>}<time>{timeLabel}</time></span>
  </button>
}
