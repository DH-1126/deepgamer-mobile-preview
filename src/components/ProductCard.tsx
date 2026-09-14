import { Link } from 'react-router-dom'
import { TitleBlocks } from '@deepgamer/product-presentation'
import type { Product } from '../types/catalog'
import { useCatalogTitle } from './titlePresentation'
import './product-card.css'

export function ProductCard({ product, compact = false, variant = 'default', to }: { product: Product; compact?: boolean; variant?: 'default' | 'catalogV2'; to?: string }) {
  const { result } = useCatalogTitle(product)
  if (variant === 'catalogV2') {
    const content = <>
        <div className="catalog-product-visual">
          <img src={product.image} alt="游戏账号商品预览" loading="lazy" />
          {product.verified === true && <b className="catalog-product-verified">已验号</b>}
          {result.imageBadge && <span className="catalog-product-image-badge" title={result.imageBadge.text}>{result.imageBadge.text}</span>}
        </div>
        <div className="catalog-product-info">
          <TitleBlocks result={result} />
          <footer><strong>{new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(product.price)}</strong></footer>
        </div>
      </>
    return to
      ? <Link className="catalog-product-card" to={to} aria-label={`${result.primaryText}，价格${product.price}元`}>{content}</Link>
      : <article className="catalog-product-card" tabIndex={0} aria-label={`${result.primaryText}，价格${product.price}元`}>{content}</article>
  }
  const content = <>
      <div className="product-card-visual"><img src={product.image} alt="游戏账号商品预览" loading="lazy" />{product.verified === true && <b>已验号</b>}{result.imageBadge && <span title={result.imageBadge.text}>{result.imageBadge.text}</span>}</div>
      <div className="product-info">
        <TitleBlocks result={result} />
        <div className="product-bottom">
          <strong><small>¥</small>{product.price.toFixed(2)}</strong>
          {product.verified === true && <em>平台验号</em>}
        </div>
      </div>
    </>
  return to
    ? <Link className={`product-card ${compact ? 'compact' : ''}`} to={to} aria-label={`${result.primaryText}，价格${product.price}元`}>{content}</Link>
    : <article className={`product-card ${compact ? 'compact' : ''}`} tabIndex={0} aria-label={`${result.primaryText}，价格${product.price}元`}>{content}</article>
}
