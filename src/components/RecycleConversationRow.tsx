import type { RecycleOrder } from '../types/recycle'
import { assetPath } from './assetPath'
import { getRecycleConversationName, getRecycleConversationStatus, getRecycleUnreadCount } from './recycleConversationModel'
import { CountBadge } from './ui'
import { sellGames } from '../data/sellFixtures'
import { formatConversationTime } from './messageModel'
import './message-conversation-row.css'

export function RecycleConversationRow({ item, onOpen, showTypeBadge = false }: { item: RecycleOrder; onOpen: () => void; showTypeBadge?: boolean }) {
  const name = getRecycleConversationName(item)
  const status = getRecycleConversationStatus(item)
  const unread = getRecycleUnreadCount(item)
  const game = sellGames.find(entry => entry.code === item.gameCode)
  const preview = item.messages.at(-1)?.content ?? (status === '已下单' ? '系统：回收单已创建' : '说说账号情况，开始咨询回收报价')
  const time = formatConversationTime(item.updatedAt)
  return <button type="button" className="message-conversation message-d3-row message-recycle-row" onClick={onOpen} aria-label={`${name}，${status}，${preview}，${time}${unread ? `，${unread}条未读` : ''}`}>
    <span className="message-avatar">{game?.image ? <img src={assetPath(game.image)} alt="" /> : item.gameName.slice(0, 1)}{showTypeBadge && <em data-kind="recycle">回收</em>}</span>
    <span className="message-row-copy"><span><b>{name}</b><em className={'message-d3-badge' + (status === '沟通中' ? ' communicating' : '')}>{status}</em></span><small>{preview}</small></span>
    <span className="message-d3-meta"><CountBadge count={unread} /><time>{time}</time></span>
  </button>
}
