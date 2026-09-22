import { describe, expect, it } from 'vitest'
import { HOME_REVIEW_PAGES, resolveHomeReviewNodeId, type HomeReviewState } from './homePageReview'

const baseState: HomeReviewState = {
  authenticated: false,
  showFootprints: false,
  downloadOpen: false,
  followOpen: false,
  readingSection: 'top',
}

describe('home page review registry', () => {
  it('keeps all Page7 home nodes unique and documented', () => {
    expect(HOME_REVIEW_PAGES).toHaveLength(9)
    expect(new Set(HOME_REVIEW_PAGES.map(page => page.nodeId)).size).toBe(9)
    for (const page of HOME_REVIEW_PAGES) {
      expect(page.screenName).not.toBe('')
      expect(page.summary).not.toBe('')
      expect(page.sections.length).toBeGreaterThan(0)
    }
  })

  it('resolves identity, footprints and long-page reading states', () => {
    expect(resolveHomeReviewNodeId(baseState)).toBe('7144:1039')
    expect(resolveHomeReviewNodeId({ ...baseState, authenticated: true, showFootprints: true })).toBe('7146:1316')
    expect(resolveHomeReviewNodeId({ ...baseState, authenticated: true })).toBe('7146:1627')
    expect(resolveHomeReviewNodeId({ ...baseState, readingSection: 'content' })).toBe('7146:2213')
    expect(resolveHomeReviewNodeId({ ...baseState, readingSection: 'feedback' })).toBe('7149:2434')
  })

  it('gives business overlays precedence over the scrolled content node', () => {
    expect(resolveHomeReviewNodeId({ ...baseState, downloadOpen: true, readingSection: 'feedback' })).toBe('7146:1913')
    expect(resolveHomeReviewNodeId({ ...baseState, authenticated: true, showFootprints: true, downloadOpen: true })).toBe('7152:2932')
    expect(resolveHomeReviewNodeId({ ...baseState, authenticated: true, downloadOpen: true })).toBe('7152:3256')
    expect(resolveHomeReviewNodeId({ ...baseState, authenticated: true, showFootprints: true, downloadOpen: true, followOpen: true })).toBe('7150:2655')
  })
})
