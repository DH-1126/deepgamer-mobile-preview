import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ id: '1', authenticated: false }))
vi.mock('react-router-dom', async () => ({ ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'), useParams: () => ({ id: state.id }) }))
vi.mock('../components/AuthAccess', () => ({ useAuthStatus: () => state.authenticated, useAuthPrompt: () => ({ requireAuth: vi.fn(() => false) }) }))
import { ProductDetailPage } from './ProductDetailPage'
import { LoginFloatingBar } from '../components/LoginFloatingBar'

beforeEach(() => { state.authenticated = false })

function render(id: string, tab?: string) {
  state.id = id
  return renderToStaticMarkup(<StaticRouter location={'/goods/' + id + (tab ? '?tab=' + tab : '')}><ProductDetailPage /></StaticRouter>)
}

describe('product detail independent panels', () => {
  it('uses shared section headings and compact metric values in the actual detail page', () => {
    const html = render('1')
    for (const title of ['账号实拍', '资产概览', '资产清点']) {
      expect(html).toMatch(new RegExp('data-ui="Heading"[^>]*dg-heading--section[^>]*>' + title + '</h2>'))
    }
    expect(html.match(/data-ui="SectionHeader"/g)).toHaveLength(3)
    expect(html).toContain('dg-metric-grid--value-compact')
    const guarantee = render('1', 'guarantee')
    expect(guarantee).toContain('dg-section-header__action')
    expect(guarantee).toContain('>保障规则 ')
    expect(guarantee).toMatch(/data-ui="Heading"[^>]*detail-process-title[^>]*>交易流程/)
  })
  it('uses the same underline variant with larger primary and smaller asset-category tabs', () => {
    const html = render('1')
    expect(html).toMatch(/aria-label="商品详情分区" class="dg-tabs dg-tabs--underline dg-tabs--lg detail-tabs"/)
    expect(html).toMatch(/aria-label="资产类型" class="dg-tabs dg-tabs--underline dg-tabs--md"/)
    expect(html).not.toContain('dg-tabs--underline-secondary')
  })

  it('keeps the guest prompt and purchase actions on each independent tab', () => {
    const prompt = renderToStaticMarkup(<LoginFloatingBar onLogin={() => undefined} />)
    for (const tab of ['assets', 'description', 'guarantee']) {
      const html = render('1', tab)
      expect(html.match(/<aside\b[\s\S]*?<\/aside>/g)).toEqual([prompt])
      expect(html).toContain('data-ui="ProductActionBar"')
      expect(html).toContain('立即购买')
    }
    state.authenticated = true
    expect(render('1')).not.toContain('aria-label="登录引导"')
  })

  it('defaults to assets, reverses the first two tabs and mounts only one panel', () => {
    const html = render('1')
    const tabOrder = [...html.matchAll(/aria-controls="detail-section-(.*?)"/g)].map(match => match[1])
    expect(tabOrder).toEqual(['assets', 'description', 'guarantee'])
    expect(html).toMatch(/aria-controls="detail-section-assets"[^>]*aria-selected="true"/)
    expect(html.match(/data-detail-section=/g)).toHaveLength(1)
    expect(html).toContain('资产概览')
    expect(html).not.toContain('账号信息')
    expect(html).not.toContain('平台保障范围')
    expect(html).not.toContain('查看全部资产')
    expect(html).not.toContain('asset-inventory-panel')
    expect(html).toContain('asset-overview-seal')
    expect(html).not.toContain('asset-inventory-verification')
    expect(html).not.toContain('detail-verification-stamp')
  })

  it('renders every description property without expand/collapse controls or the old stamp', () => {
    const html = render('1', 'description')
    for (const name of ['IconButton', 'MetricGrid', 'InfoList', 'Tabs', 'ProductActionBar']) expect(html).toContain('data-ui="' + name + '"')
    expect(html.match(/data-detail-section=/g)).toHaveLength(1)
    expect(html.match(/<dt /g)).toHaveLength(10)
    for (const field of ['登录方式', '交易限制', '议价状态', '铭文等级']) expect(html).toContain(field)
    for (const removed of ['查看全部账号信息', '收起账号信息', '平台验号通过', '基础信息', '交易属性', '验号核对', '最近验号', '验号时留存', '人想要', '7天']) expect(html).not.toContain(removed)
    expect(html).not.toContain('verification-seal-v2.png')
    expect(html).not.toContain('资产概览')
    expect(html).not.toContain('平台保障范围')
    expect(html).toContain('aria-label="复制商品编号 WZ0001"')
    expect(html).toMatch(/aria-label="分享商品"[^>]*><svg[^>]*lucide-share2/)
    expect(html).not.toContain('role="dialog"')
  })

  it('keeps core metrics above the tabs and the code copy action icon-only', () => {
    const html = render('1', 'description')
    const top = html.slice(html.indexOf('aria-label="账号核心指标"'), html.indexOf('aria-label="查看卖家一句话"'))
    for (const text of ['区服', '安卓QQ', '段位', '王者50星', '等级', '贵族8级']) expect(top).toContain(text)
    expect(top.match(/class="dg-metric-grid__item"/g)).toHaveLength(6)
    expect(top.indexOf('安卓QQ')).toBeLessThan(top.indexOf('王者50星'))
    expect(top.indexOf('王者50星')).toBeLessThan(top.indexOf('贵族8级'))
    const description = html.slice(html.indexOf('id="detail-section-description"'), html.indexOf('data-ui="ProductActionBar"'))
    expect(description).not.toContain('贵族8级')
    expect(description).not.toContain('安卓QQ')
    expect(description).toMatch(/data-ui="IconButton"[^>]*aria-label="复制商品编号 WZ0001"/)
    expect(description).not.toContain('>复制<')
    expect(description).not.toContain('dg-button--secondary')
  })

  it('uses the compact shared seller row with a two-line preview and a full-copy dialog entry', () => {
    const html = render('1')
    expect(html).toContain('detail-header-seller--two-lines detail-summary')
    expect(html).toContain('aria-label="查看卖家一句话" aria-haspopup="dialog" data-ui="SellerSummary"')
    expect(html).not.toContain('detail-summary-heading')
    expect(html).not.toContain('detail-summary-text')
  })

  it('presents another game as verified while preserving its own attributes', () => {
    const html = render('SJ11DG001', 'description')
    expect(html).toContain('三角洲行动')
    expect(html).toContain('547M')
    expect(html).toContain('已实名-不可改实名')
    expect(html).toContain('已验号')
    expect(html).not.toContain('待平台核验')
    expect(html).not.toContain('可二次实名')
    expect(html).not.toContain('game-wzry.png')
    expect(render('SJ11DG001')).toContain('alt="验号通过"')
  })

  it('keeps the complete five-step guarantee flow only on the guarantee panel', () => {
    const html = render('1', 'guarantee')
    expect(html.match(/data-detail-section=/g)).toHaveLength(1)
    expect(html).toMatch(/<h2 data-ui="Heading" class="dg-heading dg-heading--section dg-heading--left detail-process-title">交易流程<\/h2>/)
    const steps = html.match(/<ol class="detail-process"[\s\S]*?<\/ol>/)?.[0] ?? ''
    expect(steps.match(/<li /g)).toHaveLength(5)
    expect(html.indexOf('class="detail-guarantee-note"')).toBeGreaterThan(html.indexOf(steps) + steps.length)
    expect(html).toContain('换绑完成后系统自动确认收货并向卖家放款。')
    expect(html).not.toContain('账号信息')
    expect(html).not.toContain('资产概览')
  })

  it('does not fall back to an unrelated product for an invalid link', () => {
    const html = render('missing-detail')
    expect(html).toContain('没有找到该商品')
    expect(html).not.toContain('立即购买')
  })
})
