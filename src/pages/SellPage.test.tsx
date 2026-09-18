import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { AppraisalPage, DraftSheet, SellPage } from './SellPages'

describe('account recycling game selection', () => {
  it('keeps the game-list search entry and recent/popular games below the recycling hero', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/sell"><SellPage /></StaticRouter>)
    expect(html).toContain('</header><section class="sell-v2-game-scroll" aria-label="选择回收游戏"><div class="sell-v2-search-layout" role="search">')
    expect(html).toContain('type="button" class="sell-v2-search-entry dg-ui-focus"')
    expect(html).toContain('<span>搜索游戏名称</span></button>')
    expect(html).toContain('class="sell-v2-game-grid recent"')
    expect(html).toContain('class="sell-v2-game-grid"')
    expect(html).toContain('查看列表')
    expect(html).not.toContain('申请接入')
    expect(html).not.toContain('data-ui="Dialog"')
  })
  it('shows the requested brand message and five-step recycling flow below the games', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/sell"><SellPage /></StaticRouter>)
    for (const text of ['账号回收', '秒拿钱', '高价回收', '安全换绑', '极速到账', '0手续费', '最近看过', '热门回收', '快速回收流程']) expect(html).toContain(text)
    expect(html).toContain('alt="深度玩家吉祥物"')
    expect(html).toContain('alt="深度玩家吉祥物" width="72" height="72"')
    expect(html).not.toContain('回收商多、报价快')
    expect(html).not.toContain('选择要卖的游戏')
    const flow = html.slice(html.indexOf('class="sell-v2-quick-flow"'), html.indexOf('<footer'))
    expect(flow.match(/<li>/g)).toHaveLength(5)
    const steps = ['提供信息', '价格沟通', '验号换绑', '签署合同', '极速到账']
    for (let index = 0; index < steps.length - 1; index++) expect(flow.indexOf(steps[index])).toBeLessThan(flow.indexOf(steps[index + 1]))
    expect(html.indexOf('class="sell-v2-quick-flow"')).toBeGreaterThan(html.indexOf('class="sell-v2-game-grid"'))
  })
})

describe('game recycler list', () => {
  it('keeps the title and game switch above the list, with a plain safety reminder at the bottom', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/appraisal?game=wzry"><AppraisalPage /></StaticRouter>)
    expect(html).toMatch(/<h1 data-ui="Heading" class="[^"]*dg-heading--hero[^"]*">账号回收工作室<\/h1>/)
    expect(html).toContain('class="sell-v2-studio-mascot"')
    expect(html).toContain('alt="" width="72" height="72"')
    expect(html).toContain('aria-label="切换回收游戏，当前王者荣耀"')
    expect(html).toContain('class="sell-v2-studio-game-switch"')
    expect(html).toContain('aria-label="交易风险提醒"')
    expect(html).not.toContain('data-ui="InlineNotice"')
    expect(html).toContain('私下交易有风险，钱号两空无保障，未成年人禁止售卖账号')
    expect(html).not.toContain('咨询估价免费')
    expect(html).not.toContain('收到正式回收单后再决定是否出售')
    expect(html).not.toContain('sell-v2-studio-intro')
    expect(html).not.toContain('sell-v2-studio-warning')
    expect(html).toContain('</section><footer class="sell-v2-note" aria-label="交易风险提醒">提醒：私下交易有风险，钱号两空无保障，未成年人禁止售卖账号</footer></main>')
    expect(html.indexOf('aria-label="交易风险提醒"')).toBeGreaterThan(html.lastIndexOf('data-ui="RecyclerCard"'))
    expect(html).not.toContain('class="sell-v2-selected-game"')
    expect(html).not.toContain('>王者荣耀回收商</h1>')
  })

  it('renders every merchant through the shared card and counts online merchants correctly', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/appraisal?game=wzry"><AppraisalPage /></StaticRouter>)
    expect(html.match(/data-ui="RecyclerCard"/g)).toHaveLength(4)
    expect(html.match(/data-ui="Button"/g)).toHaveLength(4)
    expect(html.match(/>接单中<\/span>/g)).toHaveLength(3)
    expect(html.match(/disabled=""/g)).toHaveLength(1)
    expect(html).toContain('4 家回收商 · 3 家接单中')
    expect(html).toContain('href="/game/select?scene=sell&amp;current=wzry"')
  })

  it('keeps game-specific merchant filtering', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/appraisal?game=peace"><AppraisalPage /></StaticRouter>)
    expect(html.match(/data-ui="RecyclerCard"/g)).toHaveLength(2)
    expect(html).toContain('真趣十足')
    expect(html).toContain('稳收阁')
    expect(html).not.toContain('峡谷回收')
    expect(html).not.toContain('夜猫回收')
  })

  it('provides a game-switching empty state while keeping the risk reminder', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/appraisal?game=naruto"><AppraisalPage /></StaticRouter>)
    expect(html).toContain('暂无回收工作室')
    expect(html).toContain('data-ui="EmptyStateView"')
    expect(html).toContain('>切换游戏</button>')
    expect(html).toContain('0 家回收商 · 0 家接单中')
    expect(html).toContain('>切换游戏</button>')
    expect(html).toContain('未成年人禁止售卖账号')
    expect(html.indexOf('aria-label="交易风险提醒"')).toBeGreaterThan(html.indexOf('>切换游戏</button>'))
    expect(html).not.toContain('data-ui="InlineNotice"')
    expect(html).not.toContain('data-ui="RecyclerCard"')
  })
})

describe('recycle order draft', () => {
  it('renders the complete business form and echoes the supplied draft instead of samples', () => {
    const draft = { loginAccount: 'player_actual', realnameStatus: '不包人脸' as const, nobleLevel: 'V9' as const, antiAddiction: '无防沉迷' as const, quoteCents: 26800, screenshots: [{ id: 'shot-a', name: 'assets.webp', mimeType: 'image/webp' as const, size: 2048 }], note: '荣耀典藏皮肤较多' }
    const html = renderToStaticMarkup(<DraftSheet draft={draft} errors={{}} onChange={() => undefined} onClose={() => undefined} onSubmit={() => undefined} submitLabel="确认修改" />)
    for (const text of ['登录账号', '实名情况', '贵族等级', '有无防沉迷', '回收报价', '补充截图', '合计最多 15 张', '补充说明', '确认修改']) expect(html).toContain(text)
    for (const value of ['player_actual', '不包人脸', 'V9', '无防沉迷', '268', 'assets.webp', '荣耀典藏皮肤较多']) expect(html).toContain(value)
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
    expect(html).toContain('multiple=""')
    expect(html).not.toContain('value="22"')
  })
})
