import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FullScreenPanel, InfoList, MetricGrid, ProductActionBar } from './index'

describe('detail UI primitives', () => {
  it('uses a shared compact value size for the six detail attributes instead of page CSS overrides', () => {
    const html = renderToStaticMarkup(<MetricGrid variant="emphasis" valueSize="compact" columns={3} items={[{ label: '区服', value: '安卓QQ' }, { label: '英雄', value: 0 }]} />)
    expect(html).toContain('dg-metric-grid--value-compact')
    expect(html).toContain('dg-metric-grid--emphasis')
    expect(html).toContain('>0<')
    expect(renderToStaticMarkup(<MetricGrid items={[]} />)).not.toContain('dg-metric-grid--value-compact')
  })
  it('renders metric variants with the requested responsive columns and preserves zero values', () => {
    const html = renderToStaticMarkup(<><MetricGrid columns={2} label="账号数据" items={[{ label: '粉丝', value: 0 }, { label: '点赞', value: '12' }]} /><MetricGrid variant="emphasis" items={[{ label: '评分', value: '9.8' }]} /><MetricGrid variant="summary" columns={4} items={[{ label: '余额', value: '¥0' }]} /></>)
    expect(html).toContain('data-ui="MetricGrid"')
    expect(html).toContain('aria-label="账号数据"')
    expect(html).toContain('dg-metric-grid--2')
    expect(html).toContain('dg-metric-grid--emphasis')
    expect(html).toContain('dg-metric-grid--summary')
    expect(html).toContain('>0<')
  })

  it('uses a semantic non-clickable definition list and exposes its hint control', () => {
    const html = renderToStaticMarkup(<InfoList onHint={vi.fn()} items={[{ id: 'guarantee', label: '保障', value: <button type="button">复制</button>, tone: 'success', hint: '可申请售后' }, { id: 'real-name', label: '实名状态', value: '已认证', hint: '认证说明' }]} />)
    expect(html).toContain('data-ui="InfoList"')
    expect(html).toContain('<dl')
    expect(html).toContain('<dt')
    expect(html).toContain('<dd')
    expect(html).toContain('aria-label="保障说明"')
    expect(html).toContain('aria-label="实名状态说明"')
    expect(html).toContain('dg-info-list__row--success')
    expect(html).toContain('>复制</button>')
  })

  it('does not render an inert hint button when no hint callback is supplied', () => {
    const html = renderToStaticMarkup(<InfoList items={[{ id: 'guarantee', label: '保障', value: '支持售后', hint: '可申请售后' }]} />)
    expect(html).toContain('title="可申请售后"')
    expect(html).not.toContain('dg-info-list__hint dg-ui-focus')
  })

  it('keeps purchase disabled, favorite pressed state, and separate action controls accessible', () => {
    const html = renderToStaticMarkup(<ProductActionBar favorite onFavorite={vi.fn()} onConsult={vi.fn()} onPurchase={vi.fn()} purchaseDisabled purchaseLabel="暂不可购买" />)
    expect(html).toContain('data-ui="ProductActionBar"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('暂不可购买')
    expect(html).toContain('disabled=""')
    expect(html.match(/type="button"/g)).toHaveLength(3)
  })

  it('supports SSR and supplies the full-screen dialog name, custom header, footer, and theme', () => {
    const hidden = renderToStaticMarkup(<FullScreenPanel open={false} onClose={vi.fn()} title="购买确认">内容</FullScreenPanel>)
    const shown = renderToStaticMarkup(<FullScreenPanel open onClose={vi.fn()} title="购买确认" theme="dark" header={<header>自定义抬头</header>} footer={<button type="button">提交</button>}>内容</FullScreenPanel>)
    expect(hidden).toBe('')
    expect(shown).toContain('data-ui="FullScreenPanel"')
    expect(shown).toContain('role="dialog"')
    expect(shown).toContain('aria-label="购买确认"')
    expect(shown).toContain('dg-full-screen-panel--dark')
    expect(shown).toContain('自定义抬头')
    expect(shown).toContain('>提交</button>')
  })
})
