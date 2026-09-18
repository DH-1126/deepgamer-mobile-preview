import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { createMessageSeed, SUPPORT_CONVERSATION_ID, SUPPORT_CONVERSATION_ROUTE, SUPPORT_RECOMMENDATION_ROUTE } from '../data/messageFixtures'
import { SupportChatPage } from './SupportChatPage'

function render(location: string) {
  const seed = createMessageSeed(2_000_000_000_000)
  const conversation = seed.conversations.find(item => item.id === SUPPORT_CONVERSATION_ID)!
  return renderToStaticMarkup(<StaticRouter location={location}><SupportChatPage conversation={conversation} messages={[]} /></StaticRouter>)
}

describe('customer support entry destinations', () => {
  it('opens game recommendations for primary-page entries', () => {
    const html = render(SUPPORT_RECOMMENDATION_ROUTE)
    expect(html).toContain('专属客服在线咨询')
    expect(html).toContain('aria-label="搜索游戏"')
    expect(html).toContain('热门推荐')
    expect(html).not.toContain('aria-label="客服聊天记录"')
  })

  it.each([SUPPORT_CONVERSATION_ROUTE, `${SUPPORT_CONVERSATION_ROUTE}?scenario=chat`, '/message/groups/support-mengmeng'])('opens chat directly at %s', route => {
    const html = render(route)
    expect(html).toContain('aria-label="客服聊天记录"')
    expect(html).toContain('aria-label="输入你的问题"')
    expect(html).not.toContain('专属客服在线咨询')
  })

  it('restores the selected game from the chat URL', () => {
    const html = render(`${SUPPORT_CONVERSATION_ROUTE}?scenario=chat&gameCode=hpjy`)
    expect(html).toContain('和平精英')
    expect(html).not.toContain('王者荣耀')
    expect(html).toContain('aria-label="客服聊天记录"')
  })

  it('keeps the existing settings entry available', () => {
    expect(render(`${SUPPORT_CONVERSATION_ROUTE}?scenario=settings`)).toContain('role="dialog"')
  })

  it('shows real game recommendations and a visible recycle entry for product consultation', () => {
    const html = render(`${SUPPORT_CONVERSATION_ROUTE}?scenario=recommend&gameCode=wzry`)
    expect(html).toContain('找号结果')
    expect(html).toContain('王者50')
    expect(html).toContain('href="/goods/1"')
    expect(html).toContain('卖号/回收入口')
    expect(html).toContain('href="/sell"')
  })

  it('keeps the exact product in a dismissible pending-send card', () => {
    const html = render(`${SUPPORT_CONVERSATION_ROUTE}?scenario=product&productId=2114872829163482747&gameCode=sjzxd`)
    expect(html).toContain('SJ11DG001')
    expect(html).toContain('¥3,308')
    expect(html).toContain('发送商品')
    expect(html).toContain('aria-label="关闭待发送商品"')
    expect(html).not.toContain('未发送到真实客服后台')
  })

  it('does not substitute another product when an unknown id is requested', () => {
    const html = render(`${SUPPORT_CONVERSATION_ROUTE}?scenario=product&productId=missing&gameCode=wzry`)
    expect(html).toContain('商品信息已失效')
    expect(html).not.toContain('发送商品')
  })
})
