import { describe, expect, it } from 'vitest'
import { AUTH_DESIGN_PROMPTS } from './authDesignPrompts'
import { HOME_REVIEW_PAGES } from './homePageReview'
import { STARTUP_REVIEW_PAGES } from './startupPageReview'
import { AUTH_LOCAL_REVIEW_PAGES } from './authLocalPageReview'
import { BUSINESS_PAGE_SPECS, getPageReviewReference, getPageReviewSpec } from './pageReviewRegistry'
import { resolveOrderDetailNodeId } from './orderPageSpecs'
import { resolveAftersalesDetailNodeId } from './aftersalesPageSpecs'
import { resolveTradeChatNodeId } from './messagePageSpecs'

const registeredPages = [
  ...AUTH_DESIGN_PROMPTS.map((page) => ({ nodeId: page.nodeId })),
  ...HOME_REVIEW_PAGES,
  ...STARTUP_REVIEW_PAGES,
  ...AUTH_LOCAL_REVIEW_PAGES,
  ...BUSINESS_PAGE_SPECS,
]

describe('page review registry', () => {
  it('documents every registered screen by elements with all required implementation fields', () => {
    for (const page of registeredPages) {
      const spec = getPageReviewSpec(page.nodeId)!
      expect(spec.elements.length, page.nodeId).toBeGreaterThan(1)
      expect(new Set(spec.elements.map(element => element.name)).size, page.nodeId).toBe(spec.elements.length)
      for (const element of spec.elements) {
        for (const key of ['name', 'component', 'visual', 'dimensions', 'typography', 'interaction', 'ui', 'dataSource', 'dataContent'] as const) {
          expect(element[key].trim().length, `${page.nodeId}: ${element.name} / ${key}`).toBeGreaterThan(0)
        }
        expect(element.evidence.length).toBeGreaterThan(0)
      }
    }
  })
  it('keeps every existing login and new home reference paired with a spec', () => {
    const pages = [...AUTH_DESIGN_PROMPTS, ...HOME_REVIEW_PAGES]
    expect(new Set(pages.map(page => page.nodeId)).size).toBe(pages.length)
    for (const page of pages) {
      const reference = getPageReviewReference(page.nodeId)
      expect(reference?.figmaUrl).toContain(`node-id=${page.nodeId.replace(':', '-')}`)
      expect(reference?.prompt).toContain(reference?.figmaUrl)
      expect(getPageReviewSpec(page.nodeId)?.sections.length).toBeGreaterThan(0)
    }
  })
  it('does not invent Figma links for startup states without a current design frame', () => {
    for (const page of [...STARTUP_REVIEW_PAGES, ...AUTH_LOCAL_REVIEW_PAGES]) {
      const reference = getPageReviewReference(page.nodeId)
      expect(reference?.figmaUrl).toBeUndefined()
      expect(reference?.prompt).toBeUndefined()
      expect(reference?.referenceNote).toBeTruthy()
      expect(getPageReviewSpec(page.nodeId)).toBeDefined()
    }
  })
  it('keeps business page node ids unique and either Figma-backed or locally noted', () => {
    expect(new Set(BUSINESS_PAGE_SPECS.map((page) => page.nodeId)).size).toBe(BUSINESS_PAGE_SPECS.length)
    for (const page of BUSINESS_PAGE_SPECS) {
      const reference = getPageReviewReference(page.nodeId)
      const spec = getPageReviewSpec(page.nodeId)
      expect(reference, page.nodeId).toBeDefined()
      expect(spec?.summary.length, page.nodeId).toBeGreaterThan(12)
      expect(spec?.sections.length, page.nodeId).toBeGreaterThanOrEqual(2)
      for (const section of spec!.sections) {
        expect(section.items.length).toBeGreaterThan(0)
        expect(section.items.every((item) => item.trim().length > 8), `${page.nodeId}: ${section.title}`).toBe(true)
      }
      if (page.figmaFileKey) {
        expect(reference?.figmaUrl, page.nodeId).toContain(`https://www.figma.com/design/${page.figmaFileKey}/`)
        expect(reference?.figmaUrl).toContain(`node-id=${page.nodeId.replace(':', '-')}`)
        expect(reference?.prompt).toContain(reference?.figmaUrl!)
      } else {
        expect(reference?.figmaUrl, page.nodeId).toBeUndefined()
        expect(reference?.prompt).toBeUndefined()
        expect(reference?.referenceNote, page.nodeId).toBeTruthy()
      }
    }
  })
  it('resolves state-driven pages to documented spec nodes', () => {
    expect(resolveOrderDetailNodeId('pending')).toBe('orders:detail-pending')
    expect(resolveOrderDetailNodeId('paid')).toBe('3964:663')
    expect(resolveOrderDetailNodeId('bind_success')).toBe('3964:1179')
    expect(resolveOrderDetailNodeId('completed')).toBe('3964:1361')
    expect(resolveOrderDetailNodeId('closed')).toBe('3964:1522')
    expect(resolveOrderDetailNodeId('cancelled')).toBe('orders:detail-terminal')
    for (const status of ['pending', 'paid', 'verifying', 'binding', 'signed', 'insuring', 'insured', 'bind_success', 'completed', 'closed', 'pay_expired', 'cancelled']) {
      expect(getPageReviewSpec(resolveOrderDetailNodeId(status)), status).toBeDefined()
    }
    expect(resolveAftersalesDetailNodeId('pending_review')).toBe('aftersales:detail-review')
    expect(resolveAftersalesDetailNodeId('supplement')).toBe('aftersales:detail-supplement')
    for (const status of ['pending_review', 'supplement', 'platform_processing', 'rejected', 'refunding', 'completed', 'withdrawn']) {
      expect(getPageReviewSpec(resolveAftersalesDetailNodeId(status)), status).toBeDefined()
    }
    expect(resolveTradeChatNodeId('materials', 'seller')).toBe('3993:127')
    expect(resolveTradeChatNodeId('inspection', 'buyer')).toBe('3993:684')
    expect(resolveTradeChatNodeId('release', 'buyer')).toBe('3993:916')
    for (const phase of ['materials', 'inspection', 'binding', 'release', 'paused', 'completed']) {
      for (const role of ['buyer', 'seller'] as const) {
        expect(getPageReviewSpec(resolveTradeChatNodeId(phase, role)), `${phase}/${role}`).toBeDefined()
      }
    }
  })
  it('leaves genuinely unknown screens unregistered', () => {
    expect(getPageReviewReference('unknown')).toBeUndefined()
    expect(getPageReviewSpec('unknown')).toBeUndefined()
  })
})
