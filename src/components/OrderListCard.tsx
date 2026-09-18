import { useId } from 'react'
import { Archive } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { OrderRecord } from '../types/order'
import { ActionLink, Button } from './ui'
import { formatOrderListMoney, getOrderListPresentation } from './orderListPresentation'
import './order-list-card.css'

export type OrderListCardProps = {
  order: OrderRecord
  now: number
  onShowPayout?: (order: OrderRecord) => void
}

/** Reusable, presentational order summary. State transitions remain with its parent page. */
export function OrderListCard({ order, now, onShowPayout }: OrderListCardProps) {
  const titleId = useId()
  const presentation = getOrderListPresentation(order, now)
  const detailRoute = `/orders/${encodeURIComponent(order.id)}`

  return <article className={`dg-order-list-card dg-order-list-card--${presentation.tone}${presentation.isRecycle ? ' dg-order-list-card--recycle' : ''}`} data-ui="OrderListCard" aria-labelledby={titleId}>
    <header className="dg-order-list-card__header">
      <small>订单号 {order.id}</small>
      <span className="dg-order-list-card__badges">{presentation.isRecycle && <span className="dg-order-list-card__recycle-badge"><Archive size={11} aria-hidden="true" />回收</span>}<span className="dg-order-list-card__status"><i aria-hidden="true" />{presentation.statusLabel}</span></span>
    </header>
    <Link className="dg-order-list-card__product" to={detailRoute} aria-label={`查看订单 ${order.id} 详情`}>
      {presentation.isRecycle ? <span className="dg-order-list-card__recycle-image" aria-hidden="true"><Archive size={22} strokeWidth={2.1} /></span> : <img src={order.thumbnail} alt="" />}
      <span className="dg-order-list-card__copy">
        <h2 id={titleId}>{presentation.isRecycle && !order.productTitle.startsWith('回收商品') ? `回收商品 · ${order.productTitle}` : order.productTitle}</h2>
        {presentation.tags.length > 0 && <span className="dg-order-list-card__tags">{presentation.tags.map((tag, index) => <em key={`${tag}-${index}`}>{tag}</em>)}</span>}
        <strong>{formatOrderListMoney(presentation.amountCents)}</strong>
      </span>
    </Link>
    {presentation.countdown && <p className="dg-order-list-card__countdown"><span>剩余有效期</span><time dateTime={`PT${Math.max(0, Math.ceil(((order.expiresAt ?? now) - now) / 1000))}S`}>{presentation.countdown}</time></p>}
    <p className="dg-order-list-card__description">{presentation.description}</p>
    <footer className="dg-order-list-card__actions">
      {presentation.actions.map(action => action.label === '查看打款明细' && onShowPayout
        ? <Button key={action.label} variant="primary" size="sm" className="dg-order-list-card__action dg-order-list-card__action--primary" onClick={() => onShowPayout(order)}>查看打款明细</Button>
        : <ActionLink key={action.label} to={action.to} variant={action.variant} size="sm" className={`dg-order-list-card__action dg-order-list-card__action--${action.variant}`}>{action.label === '查看打款明细' ? '查看订单详情' : action.label}</ActionLink>)}
    </footer>
  </article>
}
