import type { ReactNode } from 'react'
import { Heart, Info } from 'lucide-react'
import { Button } from './primitives'
import './detailPrimitives.css'

const join = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

export type MetricGridProps = { items: { label: string; value: ReactNode }[]; columns?: 2 | 3 | 4; variant?: 'plain' | 'emphasis' | 'summary'; valueSize?: 'default' | 'compact'; label?: string; className?: string }
export function MetricGrid({ items, columns = 3, variant = 'plain', valueSize = 'default', label, className }: MetricGridProps) {
  return <section data-ui="MetricGrid" aria-label={label} className={join('dg-metric-grid', `dg-metric-grid--${variant}`, `dg-metric-grid--${columns}`, valueSize === 'compact' && 'dg-metric-grid--value-compact', className)}>
    {items.map((item, index) => <div className="dg-metric-grid__item" key={`${item.label}-${index}`}><span className="dg-metric-grid__value">{item.value}</span><span className="dg-metric-grid__label">{item.label}</span></div>)}
  </section>
}

export type InfoListProps = { items: { id: string; label: ReactNode; value: ReactNode; tone?: 'default' | 'success'; hint?: string }[]; onHint?: (id: string, hint: string) => void; className?: string }
export function InfoList({ items, onHint, className }: InfoListProps) {
  return <dl data-ui="InfoList" className={join('dg-info-list', className)}>
    {items.map((item) => <div className={join('dg-info-list__row', item.tone === 'success' && 'dg-info-list__row--success')} key={item.id}>
      <dt className="dg-info-list__label">{item.label}{item.hint && (onHint ? <button type="button" className="dg-info-list__hint dg-ui-focus" aria-label={`${typeof item.label === 'string' ? item.label : item.id}说明`} onClick={() => onHint(item.id, item.hint!)}><Info size={14} strokeWidth={1.9} aria-hidden="true" /></button> : <span className="dg-info-list__hint" title={item.hint} aria-label={`${typeof item.label === 'string' ? item.label : item.id}说明`}><Info size={14} strokeWidth={1.9} aria-hidden="true" /></span>)}</dt>
      <dd className="dg-info-list__value">{item.value}</dd>
    </div>)}
  </dl>
}

export type ProductActionBarProps = { favorite: boolean; onFavorite: () => void; onConsult: () => void; onPurchase: () => void; purchaseDisabled?: boolean; purchaseLabel?: string; className?: string }
export function ProductActionBar({ favorite, onFavorite, onConsult, onPurchase, purchaseDisabled = false, purchaseLabel = '立即购买', className }: ProductActionBarProps) {
  return <footer data-ui="ProductActionBar" className={join('dg-product-action-bar', className)}>
    <Button variant="ghost" size="md" className={join('dg-product-action-bar__favorite', favorite && 'dg-product-action-bar__favorite--active')} aria-label={favorite ? '取消收藏' : '收藏'} aria-pressed={favorite} onClick={onFavorite} icon={<Heart size={21} strokeWidth={1.8} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />}>{favorite ? '已收藏' : '收藏'}</Button>
    <Button variant="outline" size="md" className="dg-product-action-bar__consult" onClick={onConsult}>咨询</Button>
    <Button variant="primary" size="md" fullWidth className="dg-product-action-bar__purchase" disabled={purchaseDisabled} onClick={onPurchase}>{purchaseLabel}</Button>
  </footer>
}
