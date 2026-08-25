import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatFavoriteTime } from './favoritesModel'
import type { FavoriteView } from '../types/favorite'

const statusLabels = { on_sale: '售卖中', trading: '交易中', sold: '已售出', off_shelf: '已下架' } as const

export function FavoriteCard({ item, managing, selected, onToggle }: { item: FavoriteView; managing: boolean; selected: boolean; onToggle: () => void }) {
  const body = <>
    <div className="favorite-card-image">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <span aria-hidden="true">暂无图片</span>}</div>
    <div className="favorite-card-copy"><h2>{item.title}</h2><p>{item.platform}{item.eliteLevel ? ` · ${item.eliteLevel}` : ''}</p><div>{item.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div><strong>¥{item.price.toLocaleString('zh-CN')}</strong></div>
  </>

  return <article className={`favorite-item status-${item.status} ${managing ? 'is-managing' : ''} ${selected ? 'is-selected' : ''}`}>
    <div className="favorite-item-meta"><time dateTime={new Date(item.favoritedAt).toISOString()}>收藏于 {formatFavoriteTime(item.favoritedAt)}</time><span>{statusLabels[item.status]}</span></div>
    {managing
      ? <button type="button" className="favorite-manage-card" aria-label={`${selected ? '取消选择' : '选择'}${item.title}`} aria-pressed={selected} onClick={onToggle}><i aria-hidden="true">{selected && <Check size={14} strokeWidth={3} />}</i><span className="favorite-card">{body}</span></button>
      : item.navigable
        ? <Link className="favorite-card" to={`/goods/${item.productId}`} aria-label={`${item.title}，${statusLabels[item.status]}`}>{body}</Link>
        : <div className="favorite-card is-disabled" aria-label={`${item.title}，${statusLabels[item.status]}`}>{body}</div>}
  </article>
}
