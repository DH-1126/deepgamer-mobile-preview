import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InlineNotice } from './InlineNotice'

describe('InlineNotice', () => {
  it('renders a labelled, static notice without announcing an unsolicited alert', () => {
    const html = renderToStaticMarkup(<InlineNotice label="服务说明">请在平台内完成交易。</InlineNotice>)
    expect(html).toContain('data-ui="InlineNotice"')
    expect(html).toContain('aria-label="服务说明"')
    expect(html).toContain('dg-inline-notice--neutral')
    expect(html).toContain('请在平台内完成交易。')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('<button')
  })

  it('preserves complete warning content, caller spacing and native accessibility props', () => {
    const copy = '私下交易有风险，钱号两空无保障，未成年人禁止售卖账号'
    const html = renderToStaticMarkup(<InlineNotice label="交易风险提醒" tone="warning" className="page-notice" aria-describedby="extra-help"><p><strong>提醒：</strong>{copy}</p></InlineNotice>)
    expect(html).toContain('dg-inline-notice--warning page-notice')
    expect(html).toContain('aria-describedby="extra-help"')
    expect(html).toContain(`<p><strong>提醒：</strong>${copy}</p>`)
    expect(html).toContain('aria-hidden="true"')
  })

  it('supports a custom decorative icon without duplicating the default', () => {
    const html = renderToStaticMarkup(<InlineNotice label="说明" icon={<span>i</span>}>简短说明</InlineNotice>)
    expect(html).toContain('aria-hidden="true"><span>i</span>')
    expect(html).not.toContain('<svg')
  })
})
