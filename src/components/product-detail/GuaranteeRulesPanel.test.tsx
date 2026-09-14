import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GuaranteeRulesPanel } from './GuaranteeRulesPanel'

describe('GuaranteeRulesPanel', () => {
  it('does not emit an inactive overlay during SSR', () => {
    expect(renderToStaticMarkup(<GuaranteeRulesPanel open={false} onClose={vi.fn()} />)).toBe('')
  })

  it('renders the full, latest guarantee-rule copy in a named screen panel', () => {
    const html = renderToStaticMarkup(<GuaranteeRulesPanel open onClose={vi.fn()} />)

    expect(html).toContain('data-ui="FullScreenPanel"')
    expect(html).toContain('aria-label="保障规则"')
    expect(html).toContain('class="dg-full-screen-panel dg-full-screen-panel--light guarantee-rules-panel"')
    expect(html).toContain('aria-label="返回商品详情"')
    expect(html).toContain('更新时间 <b>2026-08-18</b>')
    expect(html).toContain('生效时间 <b>2026-08-18</b>')
    for (const title of ['找回包赔是什么意思', '卖号后还能申诉找回吗？', '包赔额度是多少？', '找回包赔怎么申请？']) expect(html).toContain(title)
    expect(html).toContain('&quot;服务保障&quot; 四项分别是什么？')
    expect(html).toContain('①找回 / 被盗的证据（游戏内截图 + 申诉记录）②原始订单号 ③情况说明')
    expect(html).toContain('平台按 &quot;包赔规则说明&quot; 处理。')
    expect(html).toContain('②安全交易 —— 订单记录留痕 ③专属客服 —— 1 对 1 跟进')
  })
})
