import { Link } from 'react-router-dom'
import { ListCardShell, TitleBlocks, resolveListCardVariant, type ListCardVariant } from '@deepgamer/product-presentation'
import type { Product } from '../types/catalog'
import { useCatalogTitle } from './titlePresentation'
import './product-card.css'

export function ProductCard({ product, compact = false, variant, to }: { product: Product; compact?: boolean; variant?: ListCardVariant; to?: string }) {
  const { result } = useCatalogTitle(product)
  const resolvedVariant = resolveListCardVariant(result.configuredListCardLayout, variant)
  const legacyClassName = resolvedVariant === 'catalogV2' ? 'catalog-product-card' : compact ? 'product-card compact' : 'product-card'
  return <ListCardShell
    variant={resolvedVariant}
    compact={compact}
    className={legacyClassName}
    ariaLabel={`${result.primaryText}，价格${product.price}元`}
    image={product.image}
    imageAlt="游戏账号商品预览"
    imageLoading="lazy"
    verified={product.verified === true}
    imageBadge={result.imageBadge?.text}
    price={product.price}
    systemStatus={resolvedVariant === 'default' && product.verified === true ? '平台验号' : null}
    renderRoot={({ children, ...rootProps }) => to
      ? <Link {...rootProps} to={to}>{children}</Link>
      : <article {...rootProps} tabIndex={0}>{children}</article>}
  >
    <TitleBlocks result={result} />
  </ListCardShell>
}
