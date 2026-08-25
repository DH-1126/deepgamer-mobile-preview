import { Link } from 'react-router-dom'
import type { Product } from '../types/catalog'

export function ProductCard({ product, compact = false, variant = 'default', to }: { product: Product; compact?: boolean; variant?: 'default' | 'catalogV2'; to?: string }) {
  if (variant === 'catalogV2') {
    const platformLabel = product.platform.replace('iOS', '苹果') + (product.platform.includes('区') ? '' : '区')
    const content = <>
        <div className="catalog-product-visual">
          <img src={product.image} alt="游戏账号商品预览" loading="lazy" />
          <b>{platformLabel}</b><span>{product.eliteLevel.replace('V', '贵族')}</span>
        </div>
        <div className="catalog-product-info">
          <h3>{product.displayTitle ?? product.title}</h3>
          <p>{product.inscriptionFull ? '铭文满' : '铭文未满'} · {product.secondRealName ? '可二次实名' : '不可二次实名'}</p>
          <div className="catalog-product-tags">{product.tags.slice(1, 3).map((tag) => <span key={tag}>{tag}</span>)}{product.negotiable && <span className="negotiable">支持议价</span>}</div>
          <footer><strong>{new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(product.price)}</strong><small>{product.publishedLabel}发布 {product.wantCount} 人想要</small></footer>
        </div>
      </>
    return to
      ? <Link className="catalog-product-card" to={to} aria-label={`${product.displayTitle ?? product.title}，价格${product.price}元`}>{content}</Link>
      : <article className="catalog-product-card" tabIndex={0} aria-label={`${product.displayTitle ?? product.title}，价格${product.price}元`}>{content}</article>
  }
  const content = <>
      <img src={product.image} alt="游戏账号商品预览" loading="lazy" />
      <div className="product-info">
        <h3>{product.title}</h3>
        <div className="tag-row">
          {product.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className="product-bottom">
          <strong><small>¥</small>{product.price.toFixed(2)}</strong>
          <em>平台验号</em>
        </div>
      </div>
    </>
  return to
    ? <Link className={`product-card ${compact ? 'compact' : ''}`} to={to} aria-label={`${product.title}，价格${product.price}元`}>{content}</Link>
    : <article className={`product-card ${compact ? 'compact' : ''}`} tabIndex={0} aria-label={`${product.title}，价格${product.price}元`}>{content}</article>
}
