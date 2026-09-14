import type { ResolvedTitle, TitlePiece, TitlePlacement } from '@deepgamer/product-presentation'

export type Draft3ProductPresentationInput = {
  presentationSource?: 'design_fixture'
  displayTitle?: string
  platform: string
  rank: string
  heroCount?: number
  skinCount: number
  tags?: string[]
  eliteLevel?: string
  inscriptionFull?: boolean
}

function textBlock(key: string, name: string, role: 'PRIMARY' | 'SECONDARY', pieces: TitlePiece[], placement: TitlePlacement) {
  return {
    key,
    name,
    kind: 'text' as const,
    role,
    pieces,
    separator: ' · ',
    maxLines: placement === 'DETAIL_HEADER' && role === 'PRIMARY' ? 2 : 1,
    maxItems: 4,
    theme: 'plain' as const,
  }
}

/**
 * Resolves only explicitly tagged local design fixtures. No product-title parsing,
 * identifier guessing or implicit fallback is allowed at this boundary.
 */
export function resolveDraft3ProductPresentation(input: Draft3ProductPresentationInput, placement: TitlePlacement): ResolvedTitle | null {
  if (input.presentationSource !== 'design_fixture') return null

  const structuredPrimary = [
    input.rank.trim(),
    typeof input.heroCount === 'number' ? `${input.heroCount}英雄` : '',
    `${input.skinCount}皮肤`,
  ].filter(Boolean)
  const primaryText = input.displayTitle?.trim() || structuredPrimary.join(' · ')
  const primaryPieces: TitlePiece[] = [{ key: 'design-fixture-title', text: primaryText }]
  const highlights = (input.tags ?? []).filter((tag) => tag !== input.eliteLevel).slice(0, 2)
  const secondaryPieces: TitlePiece[] = [
    ...highlights.map((tag, index) => ({ key: `design-fixture-highlight-${index}`, text: tag })),
    { key: 'design-fixture-inscription', text: input.inscriptionFull ? '铭文满' : '铭文信息以验号为准' },
  ]
  const blocks: ResolvedTitle['blocks'] = [
    textBlock('design-fixture-primary', '设计样例标题', 'PRIMARY', primaryPieces, placement),
    textBlock('design-fixture-secondary', '设计样例副标题', 'SECONDARY', secondaryPieces, placement),
  ]
  if (highlights.length) blocks.push({
    key: 'design-fixture-tags',
    name: '设计样例标签',
    kind: 'tags',
    role: 'SECONDARY',
    pieces: highlights.map((tag, index) => ({ key: `design-fixture-tag-${index}`, text: tag })),
    separator: ' · ',
    maxLines: 1,
    maxItems: 2,
    theme: 'warm',
  })

  const badgeText = input.eliteLevel?.startsWith('V') ? `贵族${input.eliteLevel.slice(1)}` : input.eliteLevel?.trim()
  return {
    placement,
    blocks,
    primaryText,
    imageBadge: badgeText ? { key: 'design-fixture-elite', text: badgeText } : null,
    warnings: [],
    fallback: false,
  }
}
