import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { nextGalleryIndex } from '../productDetailModel'
import { ImagePreview } from './ImagePreview'

describe('ImagePreview', () => {
  const items = [
    { src: '/seller.jpg', alt: '卖家实拍图', label: '卖家实拍', date: '今天 12:30', description: '账号截图清晰可核验。' },
    { src: '/proof.jpg', alt: '验号截图', source: '验号截图' },
  ]

  it('does not render for an empty gallery and protects an out-of-range index', () => {
    const empty = renderToStaticMarkup(<ImagePreview open onClose={vi.fn()} items={[]} index={0} onIndexChange={vi.fn()} />)
    const clamped = renderToStaticMarkup(<ImagePreview open onClose={vi.fn()} items={items} index={99} onIndexChange={vi.fn()} />)
    const nonFinite = renderToStaticMarkup(<ImagePreview open onClose={vi.fn()} items={items} index={Number.NaN} onIndexChange={vi.fn()} />)
    expect(empty).toBe('')
    expect(clamped).toContain('2/2')
    expect(clamped).toContain('src="/proof.jpg"')
    expect(nonFinite).toContain('1/2')
  })

  it('renders accessible navigation, source details, and selected thumbnails', () => {
    const html = renderToStaticMarkup(<ImagePreview open onClose={vi.fn()} items={[{ ...items[0], source: '验号截图' }, items[1]]} index={0} onIndexChange={vi.fn()} onShare={vi.fn()} />)
    expect(html).toContain('data-ui="FullScreenPanel"')
    expect(html).toContain('aria-label="关闭图片预览"')
    expect(html).toContain('aria-label="分享图片"')
    expect(html).toContain('aria-label="上一张图片"')
    expect(html).toContain('验号截图')
    expect(html).toContain('今天 12:30')
    expect(html).toContain('image-preview__thumbnail--selected')
  })

  it('uses the shared circular gallery index behavior', () => {
    expect(nextGalleryIndex(0, -1, 2)).toBe(1)
    expect(nextGalleryIndex(1, 1, 2)).toBe(0)
  })
})
