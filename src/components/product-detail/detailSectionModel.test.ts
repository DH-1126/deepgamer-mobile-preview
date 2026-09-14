import { describe, expect, it } from 'vitest'
import { detailSectionIds, detailTabScrollTarget, parseDetailSection, showAssetBackToTop } from './detailSectionModel'

describe('independent detail tabs', () => {
  it('defaults to assets and uses the requested tab order', () => {
    expect(detailSectionIds).toEqual(['assets', 'description', 'guarantee'])
    expect(parseDetailSection(null)).toBe('assets')
    expect(parseDetailSection('unknown')).toBe('assets')
    for (const tab of detailSectionIds) expect(parseDetailSection(tab)).toBe(tab)
  })
  it('keeps the overview stationary when switching visible tabs', () => {
    expect(detailTabScrollTarget(0, 560, 38, 1600, 640)).toBe(0)
    expect(detailTabScrollTarget(150, 560, 38, 1600, 640)).toBe(150)
  })
  it('returns a deeply scrolled panel to its own beginning, not the product header', () => {
    expect(detailTabScrollTarget(1200, 560, 38, 2000, 640)).toBe(522)
    expect(detailTabScrollTarget(0, 560, 38, 2000, 640, true)).toBe(522)
  })
  it('clamps safely for small screens, incomplete mounting and fractional geometry', () => {
    expect(detailTabScrollTarget(1200, 560, 38, 1100, 640)).toBe(460)
    expect(detailTabScrollTarget(0, 560.625, 38, 2000, 640, true)).toBe(522.625)
    expect(detailTabScrollTarget(NaN, 0, 38, 0, 0)).toBe(0)
    expect(detailTabScrollTarget(-10, 20, 38, 500, 640)).toBe(0)
  })
  it('offers back-to-top only beyond ten rows within a scrolled asset tab', () => {
    expect(showAssetBackToTop('assets', 10, true)).toBe(false)
    expect(showAssetBackToTop('assets', 11, true)).toBe(true)
    expect(showAssetBackToTop('assets', 100, false)).toBe(false)
    expect(showAssetBackToTop('description', 100, true)).toBe(false)
    expect(showAssetBackToTop('guarantee', 100, true)).toBe(false)
  })
})
