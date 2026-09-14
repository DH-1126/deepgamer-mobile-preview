import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VerificationSeal } from './VerificationSeal'

describe('shared verification seal', () => {
  it('uses the approved asset and an accessible verification result', () => {
    const html = renderToStaticMarkup(<VerificationSeal />)
    expect(html).toContain('verification-seal-v2.png')
    expect(html).toContain('alt="验号通过"')
    expect(html).toContain('draggable="false"')
    expect(html).not.toContain('watermark')
  })
  it('keeps the watermark style reusable and allows a decorative instance', () => {
    const html = renderToStaticMarkup(<VerificationSeal watermark decorative className="overview" />)
    expect(html).toContain('dg-verification-seal--watermark overview')
    expect(html).toContain('alt=""')
    expect(html).not.toContain('<button')
  })
})
