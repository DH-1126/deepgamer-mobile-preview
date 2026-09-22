import { describe, expect, it } from 'vitest'
import { AUTH_DESIGN_PROMPTS } from './authDesignPrompts'
import { AUTH_PAGE_SPECS, getAuthPageSpec } from './authPageSpecs'

describe('Page7 auth page specifications', () => {
  it('provides one specification for each Figma prompt node', () => {
    expect(AUTH_PAGE_SPECS).toHaveLength(15)
    expect(AUTH_PAGE_SPECS.map((entry) => entry.nodeId)).toEqual(AUTH_DESIGN_PROMPTS.map((entry) => entry.nodeId))
    expect(new Set(AUTH_PAGE_SPECS.map((entry) => entry.nodeId)).size).toBe(15)
  })

  it('keeps every specification useful for implementation review', () => {
    for (const spec of AUTH_PAGE_SPECS) {
      expect(spec.summary.length).toBeGreaterThan(12)
      expect(spec.sections.length).toBeGreaterThanOrEqual(2)
      for (const section of spec.sections) {
        expect(section.title.trim()).not.toBe('')
        expect(section.items.length).toBeGreaterThan(0)
        expect(section.items.every((item) => item.trim().length > 8)).toBe(true)
      }
    }
  })

  it('returns no fallback specification for an unknown node', () => {
    expect(getAuthPageSpec('not-a-page')).toBeUndefined()
  })
})
