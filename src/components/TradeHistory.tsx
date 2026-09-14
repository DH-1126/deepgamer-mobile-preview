import { Check, ShieldCheck } from 'lucide-react'
import type { Conversation, ConversationMessage } from '../types/message'
import { assetPath } from './assetPath'
import { Button, Heading, TextField } from './ui'
import '../styles/trade-history.css'

export function TradeHistory({ conversation, messages }: { conversation: Conversation; messages: ConversationMessage[] }) {
  const completedAt = messages.find(message => message.tradeCard?.key === 'completed')?.createdAt
  return <div className="trade-history" aria-label="完整交易历史">
    <p className="trade-d3-muted">会话已关闭 · 以下为按时间排列的交易记录，包含买卖双方流程卡片。</p>
    {messages.map(message => {
      const card = message.tradeCard
      return <div key={message.id} data-history-entry={card?.key ?? message.sender}>
        <time className="trade-d3-time" dateTime={new Date(message.createdAt).toISOString()}>{formatHistoryTime(message.createdAt)}</time>
        {card ? card.variant === 'product' ? <div className="trade-d3-product"><img src={assetPath('assets/games/wzry.png')} alt="王者荣耀" /><span><b>{card.title}</b><small>{conversation.productCode} · {conversation.orderId}</small></span><strong>¥{conversation.orderAmount?.toLocaleString('zh-CN')}</strong></div>
          : <section className={`trade-d3-card trade-d3-task${card.variant === 'critical' ? ' critical' : ''}${card.variant === 'completed' ? ' trade-d3-completed' : ''}`} aria-label={card.title ?? '验号按钮终态'}>
            {card.audience && <small className="trade-history-audience">{card.audience}流程卡片 · 历史记录</small>}
            {card.key === 'completed' && <i><Check size={25} /></i>}
            {card.title && <Heading as="h2" variant="section">{card.title}</Heading>}
            {card.body && <p className={card.variant === 'paused' ? 'trade-d3-paused-note' : undefined}>{card.body}</p>}
            {card.statuses?.map(status => <div key={status.text} className={`trade-history-strip ${status.tone}`}>{status.text}</div>)}
            {card.notices?.map(notice => <aside key={notice.title}><b>{notice.title}</b>{notice.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</aside>)}
            {card.fields === 'empty' && <>{['账号', '密码'].map(label => <TextField key={label} className="trade-d3-field-layout" label={`${label} *`} value="" disabled readOnly aria-label={`历史${label}表单`} />)}</>}
            {card.fields === 'credentials' && <>{['账号', '密码'].map(label => <div className="trade-d3-data" key={label}><span>{label}</span><b>***</b><button type="button" disabled aria-label={`历史${label}已脱敏，不可查看`}>查看</button></div>)}</>}
            {card.fields === 'phone' && <div className="trade-d3-data"><span>换绑手机号</span><b>***</b><button type="button" disabled>查看</button></div>}
            {card.fields === 'delivery' && <>{['账号资料一致', '已换绑至你的手机号', '资产与协商内容一致'].map(label => <div key={label} className="trade-d3-data"><span>{label}</span><b className="success">已核对 ✓</b></div>)}</>}
            {card.countdown && <p className="trade-d3-countdown">{card.countdown}</p>}
            {card.safe && <div className="trade-d3-safe"><ShieldCheck size={14} />{card.safe}</div>}
            {card.actions && <footer>{card.actions.map((label, index) => <Button key={label} size="md" variant={card.actionTones?.[index] === 'primary' ? 'primary' : 'outline'} className={`trade-history-action-${card.actionTones?.[index] ?? 'disabled'}`} title="历史操作，仅供查看" disabled>{label}</Button>)}</footer>}
            {card.key === 'completed' && completedAt && <dl><div><dt>确认放款</dt><dd>{formatHistoryTime(completedAt)}</dd></div><div><dt>群聊保留至</dt><dd>{formatHistoryTime(conversation.updatedAt)}</dd></div></dl>}
          </section>
          : message.sender === 'system' ? <div className="trade-d3-history"><ShieldCheck size={14} />{message.content}</div>
            : message.sender === 'support' ? <div className="trade-d3-support"><i>萌</i><div><small>萌萌 <em>平台客服</em></small><p>{message.content.split(/(@买家|@卖家)/g).map((part, index) => part.startsWith('@') ? <span key={index} className="trade-history-mention">{part}</span> : part)}</p></div></div>
              : <div className={`trade-d3-message${message.sender === conversation.viewerRole ? ' self' : ''}`}><small>{message.senderName}</small><p>{message.content}</p></div>}
      </div>
    })}
  </div>
}

function formatHistoryTime(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
