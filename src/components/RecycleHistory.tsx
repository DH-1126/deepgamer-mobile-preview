import { Check, ChevronRight, ShieldCheck } from 'lucide-react'
import type { RecycleHistoryCard, RecycleOrder } from '../types/recycle'
import { getRecycleConversationName } from './recycleConversationModel'
import { Heading, Button } from './ui'
import '../styles/recycle-history.css'

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`
const labels = { unsent: '尚未发送回收单', pending: '待确认', confirming: '确认中', rejected: '已拒绝', awaiting_payment: '待回收商付款', preparing_payment: '付款凭证准备中', ready_payment: '待你付款', completed: '已成交', event: '回收单变更' }

export function RecycleHistory({ order, onEnterGroup }: { order: RecycleOrder; onEnterGroup: () => void }) {
  return <div className="recycle-history" aria-label="完整回收咨询历史">
    <p className="recycle-history-caption">咨询已结束 · 按时间展示双方流程卡片，历史操作仅供查看。</p>
    {order.messages.map(message => {
      const date = new Date(message.createdAt)
      const card = message.historyCard
      return <div key={message.id} data-recycle-history={card?.state ?? message.sender}>
        <time className="recycle-history-time" dateTime={date.toISOString()}>{date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</time>
        {card ? <HistoryCard card={card} content={message.content} order={order} />
          : message.sender === 'support' ? <div className="sell-v2-support-note"><i>萌</i><span><small>萌萌　平台客服</small><p>{message.content.split(/(@回收商|@卖家)/g).map((part, index) => part.startsWith('@') ? <b className="recycle-history-mention" key={index}>{part}</b> : part)}</p></span></div>
            : <div className={`sell-v2-message ${message.sender}`}>{message.sender === 'recycler' && <i>{getRecycleConversationName(order).slice(0, 1)}</i>}<p>{message.content}</p></div>}
      </div>
    })}
    <section className="sell-v2-flow-card recycle-history-next"><Heading as="h2" variant="section">继续交易履约</Heading><p>本次回收咨询已结束，资金由平台托管。进入交易群继续资料同步、验号、换绑和确认放款。</p><Button size="sm" onClick={onEnterGroup}>进入交易群 <ChevronRight size={16} /></Button></section>
  </div>
}

function HistoryCard({ card, content, order }: { card: RecycleHistoryCard; content: string; order: RecycleOrder }) {
  const merchant = card.role === 'recycler'
  const fee = Math.round(card.quoteCents * 0.1)
  const total = card.quoteCents + fee
  const payment = ['preparing_payment', 'ready_payment'].includes(card.state)
  const actions = card.state === 'unsent' ? ['发送回收单']
    : card.state === 'pending' ? merchant ? ['修改回收单'] : ['拒绝', '确认回收单']
      : card.state === 'confirming' ? ['拒绝', '确认中…']
        : card.state === 'rejected' && merchant ? ['发送新回收单']
          : card.state === 'awaiting_payment' ? ['等待回收商付款']
            : card.state === 'preparing_payment' ? ['付款凭证准备中']
              : card.state === 'ready_payment' ? ['去付款'] : []
  if (card.state === 'event') return <section className={`recycle-history-event ${merchant ? 'recycler' : 'user'}`} aria-label={card.eventType}>
    <small>{card.eventType === '付款成功' ? '平台' : merchant ? '回收商' : '卖家'}</small>
    <dl><div><dt>回收单号</dt><dd>{card.orderId}</dd></div><div><dt>变更类型</dt><dd>{card.eventType}</dd></div></dl>
    <p>{content}</p><Button size="sm" variant="ghost" disabled title="历史回收单已在记录中完整展示">查看完整回收单 <ChevronRight size={14} /></Button>
  </section>
  if (card.state === 'unsent') return <section className="sell-v2-flow-card empty" aria-label="尚未发送回收单"><small className="recycle-history-caption">回收商流程卡片 · 历史记录</small><Heading as="h2" variant="section">尚未发送回收单</Heading><p>填写游戏账号信息和报价后发送给出号用户确认。</p><Button size="sm" disabled>发送回收单</Button></section>
  if (card.state === 'completed') return <section className="sell-v2-flow-card completed" aria-label="回收单已成交"><i><Check size={28} /></i><Heading as="h2" variant="section">已成交</Heading><strong>{money(card.quoteCents)}</strong><p>回收商付款成功，资金进入平台托管，已建立交易群。</p><p className="recycle-history-caption">回收单号：{card.orderId}</p></section>
  return <section className={`sell-v2-order-card recycle-history-card state-${card.state}`} aria-label={`${merchant ? '回收商' : '卖家'}回收单 · ${labels[card.state]}`}>
    <header><b><i />回收单 · {labels[card.state]}</b>{['pending', 'confirming'].includes(card.state) ? <small>剩 {card.state === 'confirming' ? '29:42' : '29:57'}</small> : <em>历史记录</em>}</header>
    <p className="recycle-history-audience">{merchant ? '回收商' : '卖家'}流程卡片 · {card.orderId}</p>
    <div className="sell-v2-order-price"><strong>{money(card.quoteCents)}</strong><span>{merchant ? '实际应付' : '预计到账'}<b className={merchant ? 'sell-v2-payable-amount' : undefined}>{money(merchant ? total : card.quoteCents)}</b></span></div>
    <dl><div><dt>游戏区服</dt><dd>{order.gameName} · {order.server}</dd></div><div><dt>账号概况</dt><dd>{order.rank}</dd></div>
      {payment && <><div><dt>回收价</dt><dd>{money(card.quoteCents)}</dd></div><div><dt>包赔费（10%）</dt><dd>{money(fee)}</dd></div><div><dt>总应付</dt><dd className="recycle-history-total">{money(total)}</dd></div></>}
    </dl>
    {card.state === 'rejected' ? <p className="sell-v2-order-explain">本次报价已拒绝，未产生付款，可继续沟通并发送新回收单。</p>
      : card.state === 'awaiting_payment' ? <p className="sell-v2-order-explain">卖家已确认回收单，等待回收商付款。付款成功后回收单成交，并自动建立交易群。</p>
        : payment ? <><aside><b>付款注意</b><p>卖家已确认回收单，请在时限内完成付款。超时未付回收单将自动关闭。</p></aside><div className="sell-v2-order-success"><ShieldCheck size={14} />付款成功后回收单成交，并自动建立交易群</div></>
          : !merchant && <aside><b>确认注意</b><p>确认只表示接受报价，回收商付款后才算成交。确认前请核对账号信息与报价，此后不能再以报价过低为由退单。</p></aside>}
    {actions.length > 0 && <footer>{actions.map((label, index) => <Button size="md" variant={index === 1 ? 'primary' : 'outline'} disabled title="历史操作，仅供查看" key={label} className={label === '确认中…' || ['awaiting_payment', 'preparing_payment'].includes(card.state) ? 'history-disabled' : index === 1 ? 'history-primary' : 'history-default'}>{label}</Button>)}</footer>}
  </section>
}
