import { describe, expect, it } from 'vitest'
import { resolveDraft3ProductPresentation } from './draft3ProductPresentation'

const designFixture = {
  presentationSource: 'design_fixture' as const,
  displayTitle: '王者50★ · 108英雄 · 312皮肤',
  platform: '安卓QQ',
  rank: '荣耀王者',
  heroCount: 108,
  skinCount: 312,
  tags: ['V10', '倪克斯神谕', '时之魔女'],
  eliteLevel: 'V10',
  inscriptionFull: true,
}

describe('draft 3 product presentation', () => {
  it('builds the complete named design sample from structured fields', () => {
    const result = resolveDraft3ProductPresentation(designFixture, 'LIST_CARD')!
    expect(result.primaryText).toBe('王者50★ · 108英雄 · 312皮肤')
    expect(result.blocks.find((block) => block.key === 'design-fixture-secondary')?.pieces.map((piece) => piece.text)).toEqual(['倪克斯神谕', '时之魔女', '铭文满'])
    expect(result.blocks.find((block) => block.kind === 'tags')?.pieces.map((piece) => piece.text)).toEqual(['倪克斯神谕', '时之魔女'])
    expect(result.imageBadge?.text).toBe('贵族10')
    expect(result.fallback).toBe(false)
  })

  it('does not opt an untagged product into the design fixture path', () => {
    expect(resolveDraft3ProductPresentation({ ...designFixture, presentationSource: undefined }, 'LIST_CARD')).toBeNull()
  })
})
