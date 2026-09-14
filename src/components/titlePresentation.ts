import { useMemo } from 'react'
import { resolveTitle, type ResolvedTitle, type TitleDefinition, type TitlePlacement, type TitleProduct } from '@deepgamer/product-presentation'
import { games } from '../data/fixtures'
import type { Product } from '../types/catalog'
import type { ProductDetail } from '../types/productDetail'
import { isLinkedDataMode } from '../runtime/dataMode'
import { useTitleDefinition } from './titleConfigClient'
import { resolveDraft3ProductPresentation } from './draft3ProductPresentation'
import '../styles/title-presentation.css'

function assign(values: TitleProduct['values'], keys: string[], value: TitleProduct['values'][string]) {
  if (value === undefined || value === null) return
  keys.forEach((key) => { values[key] = value })
}

/** Explicit source aliases from the local public product projection; no label or substring guessing. */
function publicValues(input: {
  skinCount: number
  heroCount?: number
  rank: string
  eliteLevel?: string
  inscriptionFull?: boolean
  attributeValues?: Product['attributeValues'] | ProductDetail['attributeValues']
}) {
  const values: TitleProduct['values'] = {}
  assign(values, ['skin_count', 'pfsl'], input.skinCount)
  assign(values, ['hero_count'], input.heroCount)
  assign(values, ['rank'], input.rank)
  assign(values, ['elite_level'], input.eliteLevel)
  assign(values, ['inscription_full'], input.inscriptionFull)
  for (const [logicalKey, value] of Object.entries(input.attributeValues ?? {})) {
    if (/^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/.test(logicalKey)) values[logicalKey] = value
  }
  return values
}

/** Linked values are a strict projection of explicitly supplied logical keys. */
export function linkedAttributeValuesToTitleValues(attributeValues: Product['attributeValues'] | ProductDetail['attributeValues']) {
  const values: TitleProduct['values'] = {}
  for (const [logicalKey, value] of Object.entries(attributeValues ?? {})) {
    if (!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/.test(logicalKey)) continue
    if (Array.isArray(value)) {
      const explicitItems = value.filter((item) => item !== null && item !== undefined && (typeof item !== 'string' || Boolean(item.trim())))
      if (explicitItems.length) values[logicalKey] = explicitItems
    } else if (value !== null && value !== undefined && (typeof value !== 'string' || value.trim())) values[logicalKey] = value
  }
  return values
}

function linkedPlatform(attributeValues: Product['attributeValues'] | ProductDetail['attributeValues']) {
  const value = attributeValues?.platform
  return typeof value === 'string' && value.trim() ? value : undefined
}

/** EMPTY pieces are resolver metadata for configured empty-value policies, not real product values. */
export function fallbackLinkedEmptyPrimary(result: ResolvedTitle, product: TitleProduct, placement: TitlePlacement): ResolvedTitle {
  const primary = result.blocks.find((block) => block.role === 'PRIMARY')
  if (result.fallback || !primary?.pieces.length || primary.pieces.some((piece) => !piece.key.startsWith('EMPTY:'))) return result
  const fallback = resolveTitle(null, product, placement)
  return {
    ...result,
    fallback: true,
    primaryText: fallback.primaryText,
    blocks: result.blocks.map((block) => block === primary ? fallback.blocks[0] : block),
  }
}

export function catalogProductToTitleProduct(product: Product): TitleProduct {
  const game = games.find((item) => item.code === product.gameCode)
  return {
    id: product.id,
    gameCode: product.gameCode,
    gameName: game?.name ?? product.gameCode,
    title: product.title,
    productCode: product.productCode ?? product.id,
    platform: isLinkedDataMode ? linkedPlatform(product.attributeValues) : product.platform,
    values: isLinkedDataMode ? linkedAttributeValuesToTitleValues(product.attributeValues) : publicValues(product),
    revision: product.listedAt,
    image: product.image,
    gameIcon: game?.image,
    price: product.price,
    verified: product.verified,
    negotiable: product.negotiable,
    wantCount: product.wantCount,
  }
}

export function detailProductToTitleProduct(detail: ProductDetail): TitleProduct {
  return {
    id: detail.id,
    gameCode: detail.gameCode,
    gameName: detail.gameName,
    title: detail.title,
    productCode: detail.productCode,
    platform: isLinkedDataMode ? linkedPlatform(detail.attributeValues) : detail.platform,
    values: isLinkedDataMode ? linkedAttributeValuesToTitleValues(detail.attributeValues) : publicValues(detail),
    revision: detail.productCode,
    image: detail.gallery[0],
    gameIcon: detail.gameIcon,
    price: detail.price,
    verified: detail.verified,
    status: detail.status,
    negotiable: detail.negotiable,
    wantCount: detail.wantCount,
  }
}

export function resolveCatalogProductTitle(definition: TitleDefinition | null | undefined, product: Product, placement: TitlePlacement = 'LIST_CARD'): { product: TitleProduct; result: ResolvedTitle } {
  const titleProduct = catalogProductToTitleProduct(product)
  const designFixture = resolveDraft3ProductPresentation(product, placement)
  const resolved = designFixture ?? resolveTitle(definition, titleProduct, placement)
  return { product: titleProduct, result: isLinkedDataMode ? fallbackLinkedEmptyPrimary(resolved, titleProduct, placement) : resolved }
}

export function resolveDetailProductTitle(definition: TitleDefinition | null | undefined, detail: ProductDetail, placement: TitlePlacement = 'DETAIL_HEADER'): { product: TitleProduct; result: ResolvedTitle } {
  const titleProduct = detailProductToTitleProduct(detail)
  const designFixture = resolveDraft3ProductPresentation(detail, placement)
  const resolved = designFixture ?? resolveTitle(definition, titleProduct, placement)
  return { product: titleProduct, result: isLinkedDataMode ? fallbackLinkedEmptyPrimary(resolved, titleProduct, placement) : resolved }
}

export function useCatalogTitle(product: Product): { product: TitleProduct; result: ResolvedTitle } {
  const { definition } = useTitleDefinition(product.gameCode)
  return useMemo(() => resolveCatalogProductTitle(definition, product), [definition, product])
}

export function useDetailTitle(detail: ProductDetail): { product: TitleProduct; result: ResolvedTitle } {
  const { definition } = useTitleDefinition(detail.gameCode)
  return useMemo(() => resolveDetailProductTitle(definition, detail), [definition, detail])
}

export function useDetailListTitle(detail: ProductDetail): { product: TitleProduct; result: ResolvedTitle } {
  const { definition } = useTitleDefinition(detail.gameCode)
  return useMemo(() => resolveDetailProductTitle(definition, detail, 'LIST_CARD'), [definition, detail])
}
