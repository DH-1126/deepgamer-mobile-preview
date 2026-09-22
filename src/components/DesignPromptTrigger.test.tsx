import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { copyDesignPrompt, DesignPromptTrigger } from './DesignPromptTrigger'

describe('DesignPromptTrigger', () => {
  it('uses one full status-bar button for time, centre and battery', () => {
    const html = renderToStaticMarkup(<DesignPromptTrigger nodeId="7080:144" />)
    expect(html).toContain('aria-label="查看页面说明"')
    expect(html).toContain('aria-controls="page-review-7080-144-spec"')
    expect(html).toContain('data-page-spec-trigger="true"')
    expect(html).toContain('data-node-id="7080:144"')
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toMatch(/<button[^>]*data-page-spec-trigger="true"[^>]*><div[^>]*data-ui="StatusBar"/)
    expect(html).toContain('<time>9:41</time>')
    expect(html).toContain('status-battery.svg')
    expect(html).not.toContain('data-design-prompt-trigger')
    expect(html).not.toContain('page-review-panel--figma')
  })

  it('renders nothing for a node that is not mapped to Page7', () => {
    expect(renderToStaticMarkup(<DesignPromptTrigger nodeId="unknown" />)).toBe('')
  })

  it('copies the complete prompt through the browser clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const prompt = 'Implement this design from Figma.\n@https://www.figma.com/design/file?node-id=1-2'
    await expect(copyDesignPrompt(prompt, { writeText })).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith(prompt)
  })

  it('reports clipboard absence and rejection without throwing', async () => {
    await expect(copyDesignPrompt('prompt', undefined)).resolves.toBe(false)
    await expect(copyDesignPrompt('prompt', { writeText: vi.fn().mockRejectedValue(new Error('denied')) })).resolves.toBe(false)
  })
})
