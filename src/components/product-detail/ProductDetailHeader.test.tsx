import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ProductDetailHeader } from './ProductDetailHeader'

const props = { price: 1280, gameName: '王者荣耀', sellerSummary: '主玩打野，李白相关皮肤较完整。', onBack: vi.fn(), onShare: vi.fn(), onOpenSeller: vi.fn() }

describe('ProductDetailHeader', () => {
  it('keeps the unscrolled navigation without a duplicate summary', () => {
    const html = renderToStaticMarkup(<ProductDetailHeader {...props} compact={false} />)
    expect(html).toContain('aria-label="返回"')
    expect(html).toContain('aria-label="分享商品"')
    expect(html).not.toContain('detail-pinned-summary')
    expect(html).not.toContain('查看顶部卖家一句话')
    expect(html).not.toContain(props.gameName)
  })

  it('places a separate summary below the unchanged titlebar', () => {
    const html = renderToStaticMarkup(<ProductDetailHeader {...props} compact />)
    const unscrolled = renderToStaticMarkup(<ProductDetailHeader {...props} compact={false} />)
    const header = html.slice(0, html.indexOf('</header>') + '</header>'.length)
    expect(header).toBe(unscrolled)
    expect(header).not.toContain(props.gameName)
    expect(header).not.toContain('¥1,280')
    expect(html).toContain('</header><section class="detail-pinned-summary" aria-label="顶部商品摘要">')
    expect(html).toContain('<div class="detail-header-identity"><strong>¥1,280</strong><span>王者荣耀</span></div>')
    expect(html).toContain('aria-label="查看顶部卖家一句话"')
    expect(html).toContain(props.sellerSummary)
    expect(html).toContain('lucide-share2')
  })

  it('has a neutral fallback when the seller has no description', () => {
    const html = renderToStaticMarkup(<ProductDetailHeader {...props} compact sellerSummary="" />)
    expect(html).toContain('卖家暂未补充描述')
    expect(html).not.toContain(props.sellerSummary)
  })
})
