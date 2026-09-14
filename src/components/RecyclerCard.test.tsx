import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { recyclerFixtures } from '../data/sellFixtures'
import { RecyclerCard } from './RecyclerCard'

describe('RecyclerCard', () => {
  it('uses shared controls and preserves the online merchant information', () => {
    const onConsult = vi.fn()
    const recycler = recyclerFixtures[0]
    const html = renderToStaticMarkup(<RecyclerCard recycler={recycler} onConsult={onConsult} />)
    expect(html).toContain('data-ui="RecyclerCard"')
    expect(html).toContain('aria-labelledby=')
    expect(html).toContain(recycler.name)
    expect(html).toContain(recycler.description)
    expect(html).toContain('平均 3 分钟响应')
    for (const tag of recycler.tags) expect(html).toContain(tag)
    expect(html).toContain('dg-status-badge--success')
    expect(html).toContain('>接单中</span>')
    expect(html).toContain('data-ui="Button"')
    expect(html).toContain('dg-button--primary dg-button--md dg-button--rounded')
    expect(html).toContain('aria-label="免费咨询真趣十足"')
    expect(html).not.toContain('disabled=')
    expect(onConsult).not.toHaveBeenCalled()
  })

  it('shows offline state, service hours and a disabled action without dimming all text', () => {
    const recycler = { ...recyclerFixtures[3], averageResponseMinutes: 5 }
    const html = renderToStaticMarkup(<RecyclerCard recycler={recycler} onConsult={() => undefined} />)
    expect(html).toContain('>休息中</span>')
    expect(html).toContain('服务时间 20:00–次日 04:00')
    expect(html).not.toContain('平均 5 分钟响应')
    expect(html).not.toContain('dg-status-badge--success')
    expect(html).toContain('dg-button--outline dg-button--md dg-button--rounded')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-label="暂不可咨询夜猫回收"')
  })

  it('keeps complete long names, descriptions and tags for fluid narrow-card layout', () => {
    const recycler = {
      ...recyclerFixtures[0],
      name: '提供多款游戏账号服务的回收商',
      description: '支持多个游戏与不同区服的账号回收，资料确认后按实际估值进行报价',
      tags: ['覆盖多个游戏与不同区服', '当天完成验号并打款', '平台资金托管'],
      averageResponseMinutes: undefined,
    }
    const html = renderToStaticMarkup(<RecyclerCard recycler={recycler} onConsult={() => undefined} />)
    expect(html).toContain(recycler.name)
    expect(html).toContain(recycler.description)
    for (const tag of recycler.tags) expect(html).toContain(tag)
    expect(html).toContain(`服务时间 ${recycler.serviceTime}`)
    expect(html.match(/<li>/g)).toHaveLength(recycler.tags.length)
    expect(html).toContain('aria-label="免费咨询提供多款游戏账号服务的回收商"')
  })

  it('keeps the action available when there are no service tags', () => {
    const recycler = { ...recyclerFixtures[0], tags: [] }
    const html = renderToStaticMarkup(<RecyclerCard recycler={recycler} onConsult={() => undefined} />)
    expect(html).not.toContain('<li>')
    expect(html).toContain('>免费咨询</button>')
  })
})
