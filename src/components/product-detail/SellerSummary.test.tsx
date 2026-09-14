import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SellerSummary } from './SellerSummary'

describe('SellerSummary', () => {
  it('shares an inline label, preview and arrow with the pinned summary', () => {
    const html = renderToStaticMarkup(<SellerSummary text="主玩打野" onOpen={vi.fn()} label="查看顶部卖家一句话" />)
    expect(html).toContain('class="detail-header-seller"')
    expect(html).not.toContain('detail-header-seller--two-lines')
    expect(html).toContain('aria-label="查看顶部卖家一句话" aria-haspopup="dialog"')
    expect(html).toContain('detail-header-seller-label">卖家一句话</span>')
    expect(html).toContain('detail-header-seller-text">主玩打野</span>')
    expect(html).toContain('lucide-chevron-right')
  })

  it('clamps the overview via a two-line variant without truncating the underlying copy', () => {
    const text = '主玩打野，李白相关皮肤齐全。'.repeat(20)
    const html = renderToStaticMarkup(<SellerSummary text={text} maxLines={2} className="detail-summary" onOpen={vi.fn()} />)
    expect(html).toContain('detail-header-seller--two-lines detail-summary')
    expect(html).toContain(text)
    expect(html).toContain('aria-label="查看卖家一句话"')
  })

  it('uses the same fallback for missing seller descriptions in either placement', () => {
    for (const maxLines of [1, 2] as const) {
      const html = renderToStaticMarkup(<SellerSummary text="  " maxLines={maxLines} onOpen={vi.fn()} />)
      expect(html).toContain('卖家暂未补充描述')
    }
  })
})
