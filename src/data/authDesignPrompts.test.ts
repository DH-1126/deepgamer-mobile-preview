import { describe, expect, it } from 'vitest'
import { AUTH_DESIGN_FILE_KEY, AUTH_DESIGN_PAGE_NAME, AUTH_DESIGN_PROMPTS, getAuthDesignPrompt } from './authDesignPrompts'

const expectedNodeIds = [
  '7080:144', '7080:202', '7080:274',
  '7081:303', '7081:385', '7081:485',
  '7082:485', '7082:531', '7082:626',
  '7087:620', '7087:716', '7087:831',
  '7114:921', '7115:947', '7115:1006',
]

describe('Page7 auth design prompts', () => {
  it('maps all 15 Figma frames exactly once', () => {
    expect(AUTH_DESIGN_PROMPTS).toHaveLength(15)
    expect(AUTH_DESIGN_PROMPTS.map((entry) => entry.nodeId)).toEqual(expectedNodeIds)
    expect(new Set(AUTH_DESIGN_PROMPTS.map((entry) => entry.nodeId)).size).toBe(15)
    expect(new Set(AUTH_DESIGN_PROMPTS.map((entry) => entry.figmaUrl)).size).toBe(15)
  })

  it('builds the standard Figma implementation prompt with the precise node link', () => {
    const entry = getAuthDesignPrompt('7087:831')
    expect(entry).toBeDefined()
    expect(entry?.pageName).toBe(AUTH_DESIGN_PAGE_NAME)
    expect(entry?.figmaUrl).toBe(`https://www.figma.com/design/${AUTH_DESIGN_FILE_KEY}/%E5%9B%A2%E9%98%9F-Draft--Copy-?node-id=7087-831&m=dev`)
    expect(entry?.prompt).toBe(`Implement this design from Figma.\n@${entry?.figmaUrl}`)
  })

  it('does not invent a fallback prompt for an unmapped page', () => {
    expect(getAuthDesignPrompt('missing')).toBeUndefined()
  })
})
